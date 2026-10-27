export const SEARCH_DEPTHS = ["quick", "thorough"] as const;
export type SearchDepth = (typeof SEARCH_DEPTHS)[number];

export interface DepthPreset {
  label: string;
  description: string;
  maxQueries: number;
  resultsPerQuery: number;
  maxSitesToFetch: number;
  pagesPerSite: number;
  employerLookups: number;
  maxClassifications: number;
}

export const DEPTH_PRESETS: Record<SearchDepth, DepthPreset> = {
  quick: {
    label: "Quick",
    description: "~5 searches, faster and cheaper",
    maxQueries: 5,
    resultsPerQuery: 10,
    maxSitesToFetch: 8,
    pagesPerSite: 3,
    employerLookups: 0,
    maxClassifications: 40,
  },
  thorough: {
    label: "Thorough",
    description: "~12 searches plus employer lookups",
    maxQueries: 12,
    resultsPerQuery: 10,
    maxSitesToFetch: 20,
    pagesPerSite: 4,
    employerLookups: 5,
    maxClassifications: 100,
  },
};

export const LIMITS = {
  /** Identical filters within this window reuse the earlier search. */
  reuseSearchHours: 24,
  /** Per visitor (hashed IP). */
  searchesPerHour: 10,
  /** Across all visitors. */
  searchesPerDay: 100,
  /** A search still "running" after this long is shown as timed out (free AI tiers can take 10+ minutes). */
  staleSearchMinutes: 30,
  concurrency: { search: 3, fetch: 6, classify: 8 },
  fetch: {
    timeoutMs: 8_000,
    maxBytes: 2_000_000,
    maxRedirects: 3,
    /** Below this many characters of visible text, a page is treated as JavaScript-only. */
    minTextChars: 200,
    pageCacheDays: 7,
    /** Failed fetches (timeouts, "too many requests", robots.txt) are retried sooner: they're often temporary. */
    failedPageCacheHours: 6,
  },
  /** Max characters of a document sent to the classifier. */
  classifyMaxChars: 12_000,
  resultsPageSize: 50,
} as const;

/** Rough unit costs, for the per-search cost estimate shown in the UI (AI: DeepSeek V4.1 Flash on OpenCode Go, peak prices). */
export const UNIT_COSTS_USD = {
  tavilyCredit: 0.008,
  aiInputPerMillionTokens: 0.3,
  aiOutputPerMillionTokens: 1.2,
} as const;
