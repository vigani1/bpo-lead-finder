import type { CampaignId } from "@/config/campaigns";
import type { CountryFilter } from "@/config/countries";
import type { SearchDepth } from "@/config/limits";
import type { MarketFilter } from "@/config/markets";

export interface SearchFilters {
  country: CountryFilter;
  market: MarketFilter;
  campaign: CampaignId;
  depth: SearchDepth;
}

/** A saved search's filters, typed (the database stores them as plain text). */
export function filtersOf(search: { campaign: string; country: string; market: string; depth: string }): SearchFilters {
  return {
    campaign: search.campaign as SearchFilters["campaign"],
    country: search.country,
    market: search.market as SearchFilters["market"],
    depth: search.depth as SearchFilters["depth"],
  };
}
