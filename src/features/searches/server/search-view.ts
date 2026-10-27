import "server-only";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { centers, evidence, ruledOut, searches, searchResults } from "@/lib/db/schema";
import type { ResultsQuery } from "../schemas";
import type { SearchView } from "../types";
import { compareRows, matchesQuery, toResultRow } from "./result-rows";
import { groupRuledOut } from "./ruled-out";
import { toSummary } from "./summary";

/**
 * The search page's data: status, progress, re-scored results and the
 * ruled-out summary. Scores are recalculated here from saved evidence, so the
 * "Evidence age" filter works instantly without a new search.
 */
export async function getSearchView(searchId: string, query: ResultsQuery): Promise<SearchView> {
  const db = await getDb();
  const now = new Date();
  // This runs every 2 seconds while a search is live, so the four reads go out together.
  const centerIdsInSearch = db.select({ id: searchResults.centerId }).from(searchResults).where(eq(searchResults.searchId, searchId));
  const [[search], resultRows, allEvidence, ruled] = await Promise.all([
    db.select().from(searches).where(eq(searches.id, searchId)).limit(1),
    db
      .select({ result: searchResults, center: centers })
      .from(searchResults)
      .innerJoin(centers, eq(centers.id, searchResults.centerId))
      .where(eq(searchResults.searchId, searchId)),
    db.select().from(evidence).where(inArray(evidence.centerId, centerIdsInSearch)),
    db.select().from(ruledOut).where(eq(ruledOut.searchId, searchId)),
  ]);
  if (!search) throw notFound("Search");
  const summary = toSummary(search, now);

  const byCenter = Map.groupBy(allEvidence, (e) => e.centerId);
  const rows = resultRows.map(({ result, center }) =>
    toResultRow(center, byCenter.get(center.id) ?? [], result.fromEarlierSearch === 1, summary, query, now),
  );

  return {
    search: summary,
    results: rows.filter((r) => matchesQuery(r, query)).sort(compareRows(query.sort)).slice(0, 200),
    totalResults: rows.length,
    ruledOut: groupRuledOut(ruled),
  };
}
