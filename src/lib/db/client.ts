import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { withVerifiedSsl } from "./connection-string";
import * as schema from "./schema";

/**
 * The database. With `DATABASE_URL` set, a hosted Postgres (Neon) through
 * node-postgres over Neon's pooled connection; otherwise PGlite (Postgres
 * compiled to WASM, stored on disk), so the app runs with no setup. Both use the
 * same schema and migrations, and the code only sees the shared Postgres type.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

interface DbState {
  db: Db;
  ready: Promise<void>;
}

// Survive hot reloads in dev: two PGlite instances on one directory would corrupt it.
const globalForDb = globalThis as unknown as { __leadFinderDb?: DbState };

const migrationsFolder = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

/**
 * Hosted Postgres. Migrations (and pg_trgm) are applied at deploy time by
 * `pnpm db:migrate` over the direct connection, not here: many serverless
 * instances starting at once shouldn't all migrate, and Neon's pooler doesn't
 * suit schema changes.
 */
function createPostgresDb(connectionString: string): DbState {
  const pool = new Pool({ connectionString: withVerifiedSsl(connectionString) });
  // On Vercel (Fluid compute), closes idle connections before a function instance is suspended.
  attachDatabasePool(pool);
  return { db: drizzlePostgres({ client: pool, schema }), ready: Promise.resolve() };
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
