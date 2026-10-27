import "server-only";
import { filtersOf } from "@/lib/pipeline/types";
import { desc, eq } from "drizzle-orm";
import { notFound } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { centers, evidence, searches } from "@/lib/db/schema";
import { inferCountry } from "@/lib/pipeline/country";
import { scoreCenter } from "@/lib/scoring/score";
import { normalizeForMatch } from "@/lib/text";
import type { CenterView } from "../types";

function dedupeEvidence<T extends { kind: string; value: string; quote: string; seenAt: Date }>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.kind}|${row.value}|${normalizeForMatch(row.quote)}`;
    const existing = seen.get(key);
    if (!existing || existing.seenAt < row.seenAt) seen.set(key, row);
  }
  return [...seen.values()];
}

export async function getCenterView(centerId: string, options: { searchId?: string; maxAge?: number | null }): Promise<CenterView> {
  const db = await getDb();
  // Three independent reads: run them together instead of one after another.
  const [[center], rows, [search]] = await Promise.all([
    db.select().from(centers).where(eq(centers.id, centerId)).limit(1),
    db.select().from(evidence).where(eq(evidence.centerId, centerId)).orderBy(desc(evidence.seenAt)),
    options.searchId ? db.select().from(searches).where(eq(searches.id, options.searchId)).limit(1) : Promise.resolve([]),
  ]);
  if (!center) throw notFound("Center");

  let scoring: CenterView["scoring"] = null;
  if (search) {
    const { campaign, country, market } = filtersOf(search);
    const filters = { campaign, country, market };
    scoring = {
      ...scoreCenter(center, rows, { ...filters, maxEvidenceAgeDays: options.maxAge ?? null, now: new Date() }),
      ...filters,
      searchId: search.id,
    };
  }

  return {
    center: {
      id: center.id,
      name: center.name,
      entityType: center.entityType,
      domain: center.domain,
      websiteUrl: center.websiteUrl,
      websiteStatus: center.websiteStatus,
      phones: center.phones,
      emails: center.emails,
      country: center.country,
      countryConfirmed: inferCountry(center.countrySignals).confirmed,
      countrySignals: center.countrySignals,
      city: center.city,
      socialLinks: center.socialLinks,
      summary: center.summary,
      firstSeenAt: center.firstSeenAt.toISOString(),
      lastCheckedAt: center.lastCheckedAt.toISOString(),
    },
    // The same quote can be stored under two URLs of one site (www. or not): show it once, newest first.
    evidence: dedupeEvidence(rows).map((e) => ({
      id: e.id,
      kind: e.kind,
      value: e.value,
      campaignRole: e.campaignRole,
      quote: e.quote,
      matchType: e.matchType,
      sourceUrl: e.sourceUrl,
      source: e.source,
      mergeRule: e.mergeRule,
      classifier: e.classifier,
      postedAt: e.postedAt?.toISOString() ?? null,
      seenAt: e.seenAt.toISOString(),
    })),
    scoring,
  };
}
