/**
 * Market = which US consumers a campaign serves. It is a campaign attribute,
 * not the center's country: a Pakistani center can run a Spanish campaign.
 */
export const MARKET_IDS = ["english", "spanish", "bilingual"] as const;
export type MarketId = (typeof MARKET_IDS)[number];
export type MarketFilter = MarketId | "any";

export const MARKETS: Record<MarketId, { label: string; keywords: string[]; searchTerms: string[] }> = {
  english: { label: "English", keywords: [], searchTerms: [] },
  spanish: {
    label: "Spanish (US Hispanic)",
    keywords: ["spanish", "español", "espanol", "hispanic", "hispano", "latino", "se habla español", "mercado hispano", "mercado latino"],
    searchTerms: ["Spanish", "hispano"],
  },
  bilingual: {
    label: "Bilingual",
    keywords: ["bilingual", "bilingüe", "bilingue"],
    searchTerms: ["bilingual", "bilingüe"],
  },
};

/** A bilingual campaign also satisfies a Spanish-market filter. */
export function marketMatches(filter: MarketFilter, found: MarketId): boolean {
  if (filter === "any") return true;
  if (filter === "spanish") return found === "spanish" || found === "bilingual";
  return filter === found;
}
