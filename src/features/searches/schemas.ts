import { z } from "zod";
import { CAMPAIGN_IDS } from "@/config/campaigns";
import { SEARCH_DEPTHS } from "@/config/limits";
import { MARKET_IDS } from "@/config/markets";

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
