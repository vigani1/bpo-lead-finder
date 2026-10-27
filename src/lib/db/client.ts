import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * The database. With `DATABASE_URL` set, a hosted Postgres (Neon) through its
 * serverless driver; otherwise PGlite (Postgres compiled to WASM, stored on
 * disk), so the app runs with no setup. Both get the same schema, migrations
 * and pg_trgm extension, and the code only sees the shared Postgres type.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

interface DbState {
  db: Db;
  ready: Promise<void>;
}

// Survive hot reloads in dev: two PGlite instances on one directory would corrupt it.
const globalForDb = globalThis as unknown as { __leadFinderDb?: DbState };

const migrationsFolder = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

function createPostgresDb(connectionString: string): DbState {
  const client = new Pool({ connectionString });
  const db = drizzleNeon({ client, schema });
  const ready = (async () => {
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
    await migrateNeon(db, { migrationsFolder: migrationsFolder() });
  })();
  return { db, ready };
}

function createPgliteDb(databaseDir: string): DbState {
  const dataDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), databaseDir);
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite({ dataDir, extensions: { pg_trgm } });
  const db = drizzlePglite({ client, schema });
  const ready = (async () => {
    await client.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
    await migratePglite(db, { migrationsFolder: migrationsFolder() });
  })();
  return { db, ready };
}

function createDb(): DbState {
  const { DATABASE_URL, DATABASE_DIR } = env();
  return DATABASE_URL ? createPostgresDb(DATABASE_URL) : createPgliteDb(DATABASE_DIR);
}

export async function getDb(): Promise<Db> {
  const state = (globalForDb.__leadFinderDb ??= createDb());
  try {
    await state.ready;
  } catch (error) {
    // Don't keep a broken instance around: the next request retries.
    if (globalForDb.__leadFinderDb === state) globalForDb.__leadFinderDb = undefined;
    throw error;
  }
  return state.db;
}
