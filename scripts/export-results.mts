/**
 * Writes every search result with its evidence to eval-dumps/results.json, for labelling by hand.
 *   pnpm export:results   (stop the dev server first: PGlite allows one process)
 */
import { writeFileSync } from "node:fs";
import { openDb } from "./lib/open-db.mjs";

const db = openDb();
const { rows } = await db.query<Record<string, unknown>>(`
  select s.id as search_id, s.country as search_country, s.market, s.campaign, s.depth, s.created_at,
         c.id as center_id, c.name, c.entity_type, c.country, c.city, c.domain, c.phones, c.emails, c.country_signals,
         r.fit_score, r.label
  from search_results r
  join searches s on s.id = r.search_id
  join centers c on c.id = r.center_id
  order by s.created_at, r.fit_score desc`);
const evidence = await db.query<Record<string, unknown>>(
  `select center_id, kind, value, campaign_role, source, source_url, quote, classifier, posted_at, seen_at from evidence`,
);
const byCenter = Map.groupBy(evidence.rows, (e) => e.center_id as string);
const out = rows.map((r) => ({ ...r, evidence: byCenter.get(r.center_id as string) ?? [] })) as Record<string, unknown>[];
writeFileSync("eval-dumps/results.json", JSON.stringify(out, null, 1));
console.log(`${out.length} results, ${new Set(out.map((r) => r.center_id)).size} centers, ${new Set(out.map((r) => r.search_id)).size} searches`);
await db.close();
