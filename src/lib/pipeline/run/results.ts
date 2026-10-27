import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { centers, evidence, searchResults, type EvidenceKind } from "@/lib/db/schema";
import { hasCampaignEvidence, scoreCenter } from "@/lib/scoring/score";
import { inferCountry } from "../country";
import type { RunContext } from "./context";

/** Re-scores a center for this search and records it as a result (or not). */
export async function upsertResult(ctx: RunContext, centerId: string, fromEarlierSearch: boolean): Promise<boolean> {
  const [center] = await ctx.db.select().from(centers).where(eq(centers.id, centerId)).limit(1);
  if (!center) return false;
  const rows = await ctx.db.select().from(evidence).where(eq(evidence.centerId, centerId));
  if (!hasCampaignEvidence(rows, ctx.filters.campaign)) return false;
  const confirmedElsewhere = ctx.filters.country !== "any" && center.country && center.country !== ctx.filters.country && inferCountry(center.countrySignals).confirmed;
  if (confirmedElsewhere) return false;

  const result = scoreCenter(center, rows, { ...ctx.filters, maxEvidenceAgeDays: null, now: new Date() });
  const reasons = result.lines.filter((l) => l.points !== 0).map(({ signal, label, points, evidenceIds }) => ({ signal, label, points, evidenceIds }));
  await ctx.db
    .insert(searchResults)
    .values({ searchId: ctx.search.id, centerId, fitScore: result.score, label: result.label, reasons, fromEarlierSearch: fromEarlierSearch ? 1 : 0 })
    .onConflictDoUpdate({
      target: [searchResults.searchId, searchResults.centerId],
      set: { fitScore: result.score, label: result.label, reasons, fromEarlierSearch: fromEarlierSearch ? 1 : 0 },
    });
  return true;
}

/** Shows centers already known from earlier searches immediately. */
export async function addKnownCenters(ctx: RunContext) {
  const kinds: EvidenceKind[] = ["hiring", "campaign"];
  const known = await ctx.db
    .selectDistinct({ id: centers.id })
    .from(centers)
    .innerJoin(evidence, eq(evidence.centerId, centers.id))
    .where(
      and(
        inArray(evidence.kind, kinds),
        eq(evidence.value, ctx.filters.campaign),
        ctx.filters.country === "any" ? undefined : eq(centers.country, ctx.filters.country),
      ),
    )
    .limit(200);
  await Promise.all(known.map(({ id }) => upsertResult(ctx, id, true)));
}
