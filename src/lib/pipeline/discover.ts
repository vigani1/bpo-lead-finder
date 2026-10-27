import "server-only";
import pLimit from "p-limit";
import { LIMITS } from "@/config/limits";
import { SOURCE_POLICIES, type SourceId } from "@/config/sources";
import type { SearchProgress } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { getSearchSources } from "@/lib/sources";
import { SourceLimitError } from "@/lib/sources/types";
import type { DiscoveryQuery, SearchFilters, SearchHit } from "./types";

/** URLs each source returned during one search, to report what each source added. */
export type UrlsBySource = Map<SourceId, Set<string>>;

/**
 * Runs each query against every source whose policy covers that kind of query,
 * tags every hit with its source and whether it may be stored, and keeps
 * per-source stats. A source that hits its limit stops; the others continue.
 */
export async function discover(
  queries: DiscoveryQuery[],
  filters: SearchFilters,
  progress: SearchProgress,
  urlsBySource: UrlsBySource,
): Promise<SearchHit[]> {
  const sources = getSearchSources();
  const limit = pLimit(LIMITS.concurrency.search);
  const stopped = new Set<SourceId>();
  const hits: SearchHit[] = [];

  const jobs = queries.flatMap((query) =>
    sources
      .filter((source) => SOURCE_POLICIES[source.id].families.includes(query.family))
      .map((source) =>
        limit(async () => {
          if (stopped.has(source.id)) return;
          const policy = SOURCE_POLICIES[source.id];
          const stats = (progress.sourceStats[source.id] ??= { queries: 0, hits: 0, onlyHere: 0 });
          try {
            const result = await source.search(query, filters);
            stats.queries++;
            stats.hits += result.hits.length;
            progress.costs.searchCredits += result.credits;
            progress.costs.searchCostUsd = (progress.costs.searchCostUsd ?? 0) + result.costUsd;
            const urls = urlsBySource.get(source.id) ?? new Set<string>();
            for (const raw of result.hits) {
              urls.add(raw.url);
              hits.push({ ...raw, sourceId: source.id, storable: policy.storage === "storable" });
            }
            urlsBySource.set(source.id, urls);
          } catch (error) {
            if (error instanceof SourceLimitError) stopped.add(source.id);
            const message = error instanceof Error ? error.message : String(error);
            if (!progress.sourceErrors.some((e) => e.message === message)) progress.sourceErrors.push({ source: source.id, message });
            logger.warn("source query failed", { source: source.id, query: query.text, message });
          }
        }),
      ),
  );
  await Promise.all(jobs);

  // "Only here": URLs no other source returned. Shows what each extra source adds.
  for (const [id, urls] of urlsBySource) {
    const others = [...urlsBySource].filter(([other]) => other !== id).flatMap(([, set]) => [...set]);
    const otherSet = new Set(others);
    const stats = progress.sourceStats[id];
    if (stats) stats.onlyHere = [...urls].filter((u) => !otherSet.has(u)).length;
  }

  progress.counts.queries = Object.values(progress.sourceStats).reduce((sum, s) => sum + (s?.queries ?? 0), 0);
  progress.counts.hits += hits.length;
  // Storable hits first, so when two sources return the same page, the storable copy is the one kept.
  return hits.sort((a, b) => Number(b.storable) - Number(a.storable));
}
