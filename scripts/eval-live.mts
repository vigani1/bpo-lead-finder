/**
 * Re-runs the hand-labelled searches live with the configured AI model, in a
 * separate, empty database, and writes the results in the same shape as
 * eval-dumps/eval-snapshot.json, so `pnpm eval:scores` can score them against
 * eval/labels.json. Measures the whole pipeline with today's model and rules.
 * It always runs on a local PGlite database: with DATABASE_URL set, the app's
 * client would write these test searches into the hosted database instead.
 *
 *   DATABASE_URL= DATABASE_DIR=/tmp/eval-db pnpm eval:live
 *   EVAL_SNAPSHOT=eval-dumps/live-results.json pnpm eval:scores
 *
 * Uses real search credits (about 60 Tavily credits) and AI calls.
 */
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { startSearch } from "../src/features/searches/server/start-search";
import { getDb } from "../src/lib/db/client";
import { runSearch } from "../src/lib/pipeline/run/index";

if (process.env.DATABASE_URL) {
  throw new Error("Unset DATABASE_URL: eval-live must run on a separate local PGlite database.");
}
const dataDir = process.env.DATABASE_DIR ?? "";
if (!dataDir || dataDir.includes(".data/pglite")) {
  throw new Error("Set DATABASE_DIR to a separate, empty folder: this script must not mix with the app's database.");
}

// The searches the hand labels came from (eval/labels.json), with their original depth.
const SEARCHES = [
  { country: "pk", campaign: "final_expense", market: "any", depth: "quick" },
  { country: "pk", campaign: "medicare", market: "any", depth: "thorough" },
  { country: "pk", campaign: "aca", market: "any", depth: "quick" },
  { country: "pk", campaign: "life", market: "any", depth: "quick" },
  { country: "ph", campaign: "medicare", market: "any", depth: "quick" },
  { country: "ph", campaign: "final_expense", market: "any", depth: "quick" },
  { country: "in", campaign: "medicare", market: "any", depth: "quick" },
  { country: "in", campaign: "final_expense", market: "any", depth: "quick" },
  { country: "co", campaign: "medicare", market: "spanish", depth: "quick" },
] as const;

for (const search of SEARCHES) {
  const started = Date.now();
  const { searchId } = await startSearch({ ...search, refresh: true }, "eval-live-script");
  // react-doctor-disable-next-line react-doctor/async-await-in-loop
  await runSearch(searchId);
  console.log(`${search.country}/${search.campaign}: ${Math.round((Date.now() - started) / 1000)} s`);
}

const db = await getDb();
const results = await db.execute<Record<string, unknown>>(sql`
  select s.id as search_id, s.country as search_country, s.market, s.campaign, s.depth, s.created_at, s.progress,
         c.id as center_id, c.name, c.entity_type, c.country, c.city, c.domain, c.phones, c.emails, c.country_signals,
         r.fit_score, r.label
  from search_results r
  join searches s on s.id = r.search_id
  join centers c on c.id = r.center_id
  order by s.created_at, r.fit_score desc`);
const evidence = await db.execute<Record<string, unknown>>(
  sql`select center_id, kind, value, campaign_role, source, source_url, quote, classifier, posted_at, seen_at from evidence`,
);
const byCenter = Map.groupBy(evidence.rows, (e) => e.center_id as string);
const out = results.rows.map((r) => ({ ...r, evidence: byCenter.get(r.center_id as string) ?? [] }));
writeFileSync("eval-dumps/live-results.json", JSON.stringify(out, null, 1));
console.log(`Wrote ${out.length} results to eval-dumps/live-results.json`);
process.exit(0);
