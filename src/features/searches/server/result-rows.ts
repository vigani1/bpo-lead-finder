import type { CampaignId } from "@/config/campaigns";
import type { Center, Evidence } from "@/lib/db/schema";
import { inferCountry } from "@/lib/pipeline/country";
import { hasDirectCampaignProof, scoreCenter } from "@/lib/scoring/score";
import { foldAccents } from "@/lib/text";
import type { ResultsQuery } from "../schemas";
import type { ResultRow, SearchSummary } from "../types";

/** One row of the results table: the center, re-scored from its saved evidence for this search. */
export function toResultRow(center: Center, items: Evidence[], fromEarlierSearch: boolean, search: SearchSummary, query: ResultsQuery, now: Date): ResultRow {
  const scored = scoreCenter(center, items, {
    campaign: search.campaign,
    country: search.country,
    market: search.market,
    maxEvidenceAgeDays: query.maxAge,
    now,
  });
  const campaigns = [...new Set(items.filter((e) => e.kind === "hiring" || e.kind === "campaign").map((e) => e.value as CampaignId))];
  const lastSeen = items.reduce((max, e) => Math.max(max, (e.postedAt ?? e.seenAt).getTime()), 0);
  return {
    centerId: center.id,
    name: center.name,
    entityType: center.entityType,
    city: center.city,
    country: center.country,
    countryConfirmed: inferCountry(center.countrySignals).confirmed,
    campaigns,
    campaignConfirmed: hasDirectCampaignProof(items, search.campaign),
    score: scored.score,
    label: scored.label,
    topReasons: scored.lines.filter((l) => l.points > 0).sort((a, b) => b.points - a.points).slice(0, 3).map((l) => l.label),
    phones: center.phones,
    emails: center.emails,
    websiteUrl: center.websiteUrl,
    websiteStatus: center.websiteStatus,
    socialLinks: center.socialLinks,
    sourceTypes: [...new Set(items.map((e) => e.source))],
    sourceCount: new Set(items.map((e) => e.sourceUrl)).size,
    lastSeenAt: new Date(lastSeen || center.lastCheckedAt.getTime()).toISOString(),
    fromEarlierSearch,
    redFlags: scored.redFlags,
  };
}

/** The results-page filters, applied to already-scored rows. */
export function matchesQuery(row: ResultRow, query: ResultsQuery): boolean {
  if (query.minConfidence === "high" && row.label !== "high") return false;
  if (query.minConfidence === "medium" && row.label === "low") return false;
  if (query.campaignConfirmed && !row.campaignConfirmed) return false;
  if (query.hasContact && row.phones.length === 0 && row.emails.length === 0) return false;
  if (query.hasWebsite && !row.websiteUrl) return false;
  if (query.q) {
    const needle = foldAccents(query.q);
    if (![row.name, row.city ?? "", row.websiteUrl ?? ""].some((v) => foldAccents(v).includes(needle))) return false;
  }
  return true;
}

export function compareRows(sort: ResultsQuery["sort"]): (a: ResultRow, b: ResultRow) => number {
  if (sort === "recent") return (a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt);
  if (sort === "sources") return (a, b) => b.sourceTypes.length - a.sourceTypes.length || b.score - a.score;
  return (a, b) => b.score - a.score || a.name.localeCompare(b.name);
}
