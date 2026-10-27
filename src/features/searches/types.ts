import type { CampaignId } from "@/config/campaigns";
import type { CountryFilter } from "@/config/countries";
import type { SearchDepth } from "@/config/limits";
import type { MarketFilter } from "@/config/markets";
import type { SearchProgress, SearchStatus } from "@/lib/db/schema";

/** JSON-safe view models (dates as ISO strings) shared by server and client. */

export interface SearchSummary {
  id: string;
  country: CountryFilter;
  market: MarketFilter;
  campaign: CampaignId;
  depth: SearchDepth;
  status: SearchStatus;
  progress: SearchProgress;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface SearchView {
  search: SearchSummary;
}
