import type { CampaignId } from "@/config/campaigns";
import type { CountryFilter } from "@/config/countries";
import type { SearchDepth } from "@/config/limits";
import type { MarketFilter } from "@/config/markets";
import type { SourceId } from "@/config/sources";
import type { EvidenceSource, SocialLink } from "@/lib/db/schema";

export interface SearchFilters {
  country: CountryFilter;
  market: MarketFilter;
  campaign: CampaignId;
  depth: SearchDepth;
}

import type { QueryFamily } from "@/config/sources";

export type { QueryFamily };

export interface DiscoveryQuery {
  text: string;
  family: QueryFamily;
  includeDomains?: string[];
  excludeDomains?: string[];
  /** Country boost for the search API (e.g. "pakistan"). */
  countryBoost?: string;
  maxResults: number;
}

/** One search result as a source adapter returns it. */
export interface RawHit {
  url: string;
  title: string;
  snippet: string;
  publishedAt: string | null;
  query: DiscoveryQuery;
}

/** A result tagged by the discovery runner with where it came from and whether it may be stored. */
export interface SearchHit extends RawHit {
  sourceId: SourceId;
  storable: boolean;
}

/**
 * A document we can classify: a fetched website page, or a search-result
 * snippet for sources we may only link to (job ads, social pages, gigs, listings).
 */
export type DocKind = "website" | "job_ad" | "social" | "vendor_listing" | "listing";

/** A saved search's filters, typed (the database stores them as plain text). */
export function filtersOf(search: { campaign: string; country: string; market: string; depth: string }): SearchFilters {
  return {
    campaign: search.campaign as SearchFilters["campaign"],
    country: search.country,
    market: search.market as SearchFilters["market"],
    depth: search.depth as SearchFilters["depth"],
  };
}

/** The kind of source a page of each kind counts as. */
export const SOURCE_FOR_DOC_KIND: Record<DocKind, EvidenceSource> = {
  website: "website",
  job_ad: "job_board",
  social: "social",
  vendor_listing: "vendor_marketplace",
  listing: "directory",
};

export interface Doc {
  url: string;
  registeredDomain: string | null;
  kind: DocKind;
  evidenceSource: EvidenceSource;
  title: string;
  /**
   * Text the classifier reads and quotes are checked against. Snippets (job ads, social posts)
   * have personal phone numbers and emails removed in triage; company websites are business pages.
   */
  text: string;
  contentHash: string;
  publishedAt: Date | null;
  /** Country implied by the job board's domain (e.g. rozee.pk → pk). */
  boardCountry?: string;
  /** Facts read without AI, for website docs. */
  facts?: {
    siteName?: string;
    jsonLdName?: string;
    address?: string;
    phones: string[];
    emails: string[];
    socialLinks: SocialLink[];
  };
  /** Homepage of the site this page belongs to (website docs). */
  siteUrl?: string;
  /**
   * Website docs combine a site's pages into one document (one classifier
   * call per site). Each verified quote is traced back to the page it's on.
   */
  pages?: { url: string; text: string }[];
  /** False when the site's robots.txt opts out of AI input: read by the keyword rules instead. */
  aiInputAllowed?: boolean;
}
