import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { LIMITS } from "@/config/limits";
import { isCountryId } from "@/lib/all-countries";
import { AppError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { searches, type SearchProgress } from "@/lib/db/schema";
import type { StartSearchInput } from "../schemas";
import { countRecentSearches } from "./usage";

const emptyProgress = (): SearchProgress => ({
  stage: "queued",
  counts: { queries: 0, hits: 0, fetchedPages: 0, classified: 0, claimsDropped: 0, matched: 0, ruledOut: 0 },
  timingsMs: {},
  costs: { searchCredits: 0, searchCostUsd: 0, aiCalls: 0, aiInputTokens: 0, aiOutputTokens: 0 },
  sourceStats: {},
  sourceErrors: [],
  classifier: "",
  searchProvider: "",
});

/**
 * Starts a search, or reuses an identical one from the last 24 hours.
 * Rate limits are checked against the searches table (no extra service).
 */
export async function startSearch(input: Required<StartSearchInput>, ipHash: string): Promise<{ searchId: string; reused: boolean }> {
  if (input.country !== "any" && !isCountryId(input.country)) throw new AppError("VALIDATION_ERROR", "Unknown country");
  const db = await getDb();

  if (!input.refresh) {
    const [recent] = await db
      .select({ id: searches.id, status: searches.status, progress: searches.progress })
      .from(searches)
      .where(
        and(
          eq(searches.country, input.country),
          eq(searches.market, input.market),
          eq(searches.campaign, input.campaign),
          eq(searches.depth, input.depth),
          inArray(searches.status, ["queued", "running", "done"]),
          gte(searches.createdAt, new Date(Date.now() - LIMITS.reuseSearchHours * 3_600_000)),
        ),
      )
      .orderBy(desc(searches.createdAt))
      .limit(1);
    // A search that found nothing because a source was down isn't worth showing again.
    const brokenByOutage =
      recent?.status === "done" && recent.progress.counts.matched === 0 && recent.progress.sourceErrors.some((e) => e.source !== "classifier");
    if (recent && !brokenByOutage) return { searchId: recent.id, reused: true };
  }

  const used = await countRecentSearches(db, ipHash);
  if (used.thisHour >= LIMITS.searchesPerHour) {
    throw new AppError("RATE_LIMITED", `You can run ${LIMITS.searchesPerHour} new searches per hour. Try again later.`, { retryAfterSeconds: 600 });
  }
  if (used.today >= LIMITS.searchesPerDay) {
    throw new AppError("BUDGET_EXCEEDED", "Today's search budget is used up. Saved searches still work.", { retryAfterSeconds: 3600 });
  }

  const [created] = await db
    .insert(searches)
    .values({ country: input.country, market: input.market, campaign: input.campaign, depth: input.depth, ipHash, progress: emptyProgress() })
    .returning({ id: searches.id });
  return { searchId: created!.id, reused: false };
}
