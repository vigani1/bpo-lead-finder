import type { CampaignId } from "@/config/campaigns";
import type { CountryFilter } from "@/config/countries";
import type { MarketFilter } from "@/config/markets";
import type { ScoreResult } from "@/lib/scoring/score";

export interface EvidenceView {
  id: string;
  kind: string;
  value: string;
  campaignRole: string | null;
  quote: string;
  matchType: string;
  sourceUrl: string;
  source: string;
  mergeRule: string;
  classifier: string;
  postedAt: string | null;
  seenAt: string;
}

export interface CenterView {
  center: {
    id: string;
    name: string;
    entityType: string;
    domain: string | null;
    websiteUrl: string | null;
    websiteStatus: string;
    phones: string[];
    emails: string[];
    country: string | null;
    countryConfirmed: boolean;
    countrySignals: { type: string; value: string; country: string }[];
    city: string | null;
    socialLinks: { platform: string; url: string }[];
    summary: string | null;
    firstSeenAt: string;
    lastCheckedAt: string;
  };
  evidence: EvidenceView[];
  /** Score against the search the user came from, if any. */
  scoring: (ScoreResult & { campaign: CampaignId; country: CountryFilter; market: MarketFilter; searchId: string }) | null;
}
