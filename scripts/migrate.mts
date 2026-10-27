/**
 * Applies the database migrations to the hosted Postgres (Neon), over the
 * direct (unpooled) connection: schema changes don't belong on Neon's pooler.
 * Runs at deploy time (`vercel-build`), or by hand after adding a migration.
 * The local PGlite database migrates itself when the app opens it.
 *
 *   pnpm db:migrate
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { withVerifiedSsl } from "../src/lib/db/connection-string";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL_UNPOOLED (or DATABASE_URL) to the hosted database.");

const client = new Client({ connectionString: withVerifiedSsl(connectionString) });
await client.connect();
// The center-name similarity index needs pg_trgm.
await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
await migrate(drizzle({ client }), { migrationsFolder: "drizzle" });
await client.end();
console.log("Migrations applied.");
