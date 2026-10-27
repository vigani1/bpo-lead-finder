import { UNIT_COSTS_USD } from "@/config/limits";
import type { SearchProgress } from "@/lib/db/schema";

/** Estimated cost of one search in US dollars: search credits plus AI tokens. */
export function estimateCostUsd(costs: SearchProgress["costs"]): number {
  const searchCost = costs.searchCostUsd ?? costs.searchCredits * UNIT_COSTS_USD.tavilyCredit;
  return (
    searchCost +
    (costs.aiInputTokens / 1e6) * UNIT_COSTS_USD.aiInputPerMillionTokens +
    (costs.aiOutputTokens / 1e6) * UNIT_COSTS_USD.aiOutputPerMillionTokens
  );
}
