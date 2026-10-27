import type { SourceId } from "@/config/sources";
import type { DiscoveryQuery, RawHit, SearchFilters } from "@/lib/pipeline/types";

export interface SourceResult {
  hits: RawHit[];
  /** Paid units used (e.g. Tavily credits), for the usage display. */
  credits: number;
  /** Estimated cost of this request in US dollars. */
  costUsd: number;
}

/**
 * Every discovery source implements this; adding a source = one adapter file
 * plus a policy entry in `src/config/sources.ts`.
 */
export interface SearchSource {
  id: SourceId;
  label: string;
  search(query: DiscoveryQuery, filters: SearchFilters): Promise<SourceResult>;
}

/** Thrown when a source refuses more requests (quota, keyless cap, rate limit). */
export class SourceLimitError extends Error {
  constructor(
    readonly sourceId: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SourceLimitError";
  }
}
