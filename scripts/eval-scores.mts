/**
 * Measures how well the confidence labels match hand labels (eval/labels.json).
 * Reads a frozen snapshot of results and their evidence (made with
 * `pnpm export:results`, then copied to eval-dumps/eval-snapshot.json), so the
 * test set doesn't drift as the database changes. Every result is re-scored
 * with the current scoring code and today's intake rules (no LinkedIn text,
 * placeholder names rejected), so a change can be checked before and after.
 *
 *   pnpm eval:scores
 */
import { readFileSync } from "node:fs";
import type { CampaignId } from "../src/config/campaigns";
import type { CountryFilter } from "../src/config/countries";
import type { MarketFilter } from "../src/config/markets";
import { isPlaceholderName } from "../src/lib/ai/rules/company-name";
import { scoreCenter, type ConfidenceLabel } from "../src/lib/scoring/score";

type Truth = "fit" | "partial" | "not_fit";
interface Label {
  name: string;
  country: string;
  campaign: string;
  label: Truth;
  why: string;
  /** "tuning": used while changing the scoring; "held_out": from later searches, for an honest check. */
  set: "tuning" | "held_out";
}
interface SnapshotRow {
  search_country: string;
  market: string;
  campaign: string;
  name: string;
  country: string | null;
  country_signals: { type: string; country: string }[];
  phones: string[];
  emails: string[];
  domain: string | null;
  evidence: Record<string, unknown>[];
}

const key = (name: string, country: string, campaign: string) => `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}|${country}|${campaign}`;
const labels = new Map(
  (JSON.parse(readFileSync("eval/labels.json", "utf8")).labels as Label[]).map((l) => [key(l.name, l.country, l.campaign), l]),
);
const snapshot = JSON.parse(readFileSync(process.env.EVAL_SNAPSHOT ?? "eval-dumps/eval-snapshot.json", "utf8")) as SnapshotRow[];

const now = new Date();
const rows: { name: string; search: string; score: number; label: ConfidenceLabel; truth: Truth | null; set: Label["set"] | null }[] = [];
for (const r of snapshot) {
  // Today's intake rules: placeholder names never become centers; LinkedIn text isn't used.
  if (isPlaceholderName(r.name)) continue;
  const items = r.evidence
    .filter((e) => !String(e.source_url).includes("linkedin.com"))
    .map((e) => ({
      id: `${e.kind}|${e.value}|${e.source_url}|${e.quote}`,
      kind: e.kind as string,
      value: e.value as string,
      campaignRole: e.campaign_role as string | null,
      quote: e.quote as string,
      sourceUrl: e.source_url as string,
      source: e.source as string,
      postedAt: e.posted_at as string | null,
      seenAt: e.seen_at as string,
    }));
  if (items.length === 0) continue;
  const scored = scoreCenter(
    { country: r.country, countrySignals: r.country_signals, phones: r.phones, emails: r.emails, domain: r.domain },
    items,
    { campaign: r.campaign as CampaignId, country: r.search_country as CountryFilter, market: r.market as MarketFilter, maxEvidenceAgeDays: null, now },
  );
  const label = labels.get(key(r.name, r.search_country, r.campaign));
  rows.push({ name: r.name, search: `${r.search_country}/${r.campaign}`, score: scored.score, label: scored.label, truth: label?.label ?? null, set: label?.set ?? null });
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");
const avg = (list: typeof rows) => (list.length ? (list.reduce((s, r) => s + r.score, 0) / list.length).toFixed(0) : "–");

function report(title: string, labelled: typeof rows) {
  console.log(`\n== ${title}: ${labelled.length} labelled results ==`);
  console.log("confidence   fit  partial  not_fit   precision (fit / all)");
  for (const level of ["high", "medium", "low"] as const) {
    const inLevel = labelled.filter((r) => r.label === level);
    const count = (t: Truth) => inLevel.filter((r) => r.truth === t).length;
    console.log(`${level.padEnd(10)} ${String(count("fit")).padStart(5)} ${String(count("partial")).padStart(8)} ${String(count("not_fit")).padStart(8)}   ${pct(count("fit"), inLevel.length)}`);
  }
  // How often a real fit is ranked above a wrong one (100% = always, 50% = coin flip).
  const fits = labelled.filter((r) => r.truth === "fit");
  const wrong = labelled.filter((r) => r.truth === "not_fit");
  let wins = 0;
  for (const f of fits) for (const w of wrong) wins += f.score > w.score ? 1 : f.score === w.score ? 0.5 : 0;
  console.log(`ranking: a fit outranks a not-fit ${pct(wins, fits.length * wrong.length)} of the time`);
  console.log(`mean score: fit ${avg(fits)}, partial ${avg(labelled.filter((r) => r.truth === "partial"))}, not_fit ${avg(wrong)}`);

  const show = (heading: string, list: typeof rows) => {
    if (list.length === 0) return;
    console.log(heading);
    for (const r of list) console.log(`  ${r.score.toString().padStart(3)} ${r.label.padEnd(6)} ${r.name} (${r.search})`);
  };
  show("Fits marked Low:", fits.filter((r) => r.label === "low"));
  show("Not-fits marked Medium or High:", wrong.filter((r) => r.label !== "low"));
  show("Partial fits marked High:", labelled.filter((r) => r.truth === "partial" && r.label === "high"));
}

console.log(`${rows.length} results`);
report("All", rows.filter((r) => r.truth));
report("Tuning set", rows.filter((r) => r.set === "tuning"));
report("Held-out set", rows.filter((r) => r.set === "held_out"));
const unlabelled = rows.filter((r) => !r.truth);
if (unlabelled.length) console.log(`\nNot labelled yet: ${unlabelled.map((r) => `${r.name} (${r.search})`).join(", ")}`);
