import type { CampaignId } from "@/config/campaigns";
import type { CountryFilter } from "@/config/countries";
import type { SearchDepth } from "@/config/limits";
import type { MarketFilter } from "@/config/markets";
import type { SearchProgress, SearchStatus } from "@/lib/db/schema";
import type { ConfidenceLabel } from "@/lib/scoring/score";

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

export interface ResultRow {
  centerId: string;
  name: string;
  entityType: string;
  city: string | null;
  country: string | null;
  countryConfirmed: boolean;
  campaigns: CampaignId[];
  /** The requested campaign is backed by the center's own website or a job ad. */
  campaignConfirmed: boolean;
  score: number;
  label: ConfidenceLabel;
  topReasons: string[];
  phones: string[];
  emails: string[];
  websiteUrl: string | null;
  websiteStatus: string;
  socialLinks: { platform: string; url: string }[];
  sourceTypes: string[];
  sourceCount: number;
  lastSeenAt: string;
  fromEarlierSearch: boolean;
  redFlags: string[];
}

export interface RuledOutGroup {
  reason: string;
  count: number;
  examples: { url: string; name: string | null; detail: string | null }[];
}

export interface SearchView {
  search: SearchSummary;
  results: ResultRow[];
  /** Results before the user's filters were applied. */
  totalResults: number;
  ruledOut: RuledOutGroup[];
}
