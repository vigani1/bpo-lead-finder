import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

/**
 * Opens the local database the same way the app does (src/lib/db/client.ts),
 * including the pg_trgm extension its name index needs: without it, writes to
 * `centers` fail. Stop the dev server first: PGlite allows one process.
 */
export function openDb(dataDir = process.env.DATABASE_DIR ?? ".data/pglite"): PGlite {
  return new PGlite({ dataDir, extensions: { pg_trgm } });
}
