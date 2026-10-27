import { z } from "zod";
import { CAMPAIGN_IDS } from "@/config/campaigns";
import { SEARCH_DEPTHS } from "@/config/limits";
import { MARKET_IDS } from "@/config/markets";
import { EVIDENCE_AGE_OPTIONS } from "@/config/scoring";

/** Shared by the search form (client) and POST /api/searches (server). */
export const startSearchSchema = z.object({
  /** "any" or a lowercase country code; the server checks the code is a real country. */
  country: z.string().regex(/^(any|[a-z]{2})$/, "Pick a country from the list"),
  market: z.enum([...MARKET_IDS, "any"]).default("any"),
  campaign: z.enum(CAMPAIGN_IDS),
  depth: z.enum(SEARCH_DEPTHS).default("quick"),
  /** Run live even if an identical search ran recently. */
  refresh: z.boolean().default(false),
});
export type StartSearchInput = z.input<typeof startSearchSchema>;

const flag = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

/** Results filters. They live in the URL, so they're strings first. */
export const resultsQuerySchema = z.object({
  maxAge: z
    .enum(["any", ...EVIDENCE_AGE_OPTIONS.map(String)] as ["any", ...string[]])
    .optional()
    .transform((v) => (v && v !== "any" ? Number(v) : null)),
  minConfidence: z.enum(["all", "medium", "high"]).default("all"),
  campaignConfirmed: flag,
  hasContact: flag,
  hasWebsite: flag,
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["score", "recent", "sources"]).default("score"),
});
export type ResultsQuery = z.output<typeof resultsQuerySchema>;
export type ResultsQueryInput = z.input<typeof resultsQuerySchema>;

const RESULTS_QUERY_KEYS = ["maxAge", "minConfidence", "campaignConfirmed", "hasContact", "hasWebsite", "q", "sort"] as const;

/**
 * The URL's results filters as plain strings. Server prefetch and the client
 * both build the React Query key from this, so they always match.
 */
export function pickResultsQueryInput(params: Record<string, string | string[] | undefined>): ResultsQueryInput {
  const input: Record<string, string> = {};
  for (const key of RESULTS_QUERY_KEYS) {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) input[key] = first;
  }
  return resultsQuerySchema.safeParse(input).success ? (input as ResultsQueryInput) : {};
}

export const idParamSchema = z.object({ id: z.uuid() });
