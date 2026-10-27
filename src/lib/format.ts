import { CAMPAIGNS, type CampaignId } from "@/config/campaigns";
import { countryInSentence, countryLabel } from "@/config/countries";
import { MARKETS, type MarketFilter } from "@/config/markets";
import type { CountrySignal, EvidenceSource } from "@/lib/db/schema";
import type { RuledOutReason } from "@/lib/pipeline/triage";
import type { DocKind } from "@/lib/pipeline/types";
import { SOURCE_FOR_DOC_KIND } from "@/lib/pipeline/types";
import type { MergeRule } from "@/lib/resolve/resolve-center";

export function campaignLabel(id: string): string {
  return id in CAMPAIGNS ? CAMPAIGNS[id as CampaignId].label : id;
}

export function marketLabel(id: MarketFilter | string): string {
  return id === "any" ? "any" : id in MARKETS ? MARKETS[id as keyof typeof MARKETS].label : id;
}

/** A campaign's name inside a sentence: "final expense", but "Medicare". */
export function campaignInSentence(id: string): string {
  return id in CAMPAIGNS ? CAMPAIGNS[id as CampaignId].inSentence : id;
}

/**
 * "Final expense call centers in Pakistan, Spanish (US Hispanic) market";
 * mid-sentence: "final expense call centers in the Philippines".
 */
export function describeSearch(s: { campaign: string; country: string; market: string }, { midSentence = false } = {}): string {
  const where = s.country === "any" ? "anywhere" : `in ${countryInSentence(s.country)}`;
  const market = s.market === "any" ? "" : `, ${marketLabel(s.market)} market`;
  return `${midSentence ? campaignInSentence(s.campaign) : campaignLabel(s.campaign)} call centers ${where}${market}`;
}

/** "Karachi, Pakistan", "Pakistan", or "" when nothing is known. */
export function formatLocation(city: string | null, country: string | null): string {
  return [city, country ? countryLabel(country) : null].filter(Boolean).join(", ");
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diffSeconds = (new Date(iso).getTime() - now.getTime()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, seconds] of steps) {
    if (Math.abs(diffSeconds) >= seconds) return RELATIVE.format(Math.round(diffSeconds / seconds), unit);
  }
  return "just now";
}

export function formatDuration(ms: number | undefined): string {
  if (!ms) return "0 s";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Looks up a label for a value read from the database (typed as string); unknown values show as-is. */
export function labelFor<K extends string>(labels: Record<K, string>, key: string): string {
  return (labels as Record<string, string>)[key] ?? key;
}

export const RULED_OUT_LABELS: Record<RuledOutReason, string> = {
  personal_profile: "Personal profiles (not stored)",
  not_a_company_source: "Forums, news and SEO pages",
  blocked: "Removed on request",
  no_campaign_mention: "No mention of the campaign",
  not_a_center: "Not a call center",
  employer_not_named: "Employer not named",
  wrong_country: "Located in another country",
  campaign_not_evidenced: "Campaign not evidenced",
  site_unreachable: "Website unreachable or blocked",
  transient_source: "Link-only pages from a discovery-only source",
};

export const SOURCE_LABELS: Record<EvidenceSource, string> = {
  website: "Own website",
  job_board: "Job ad",
  social: "Social page",
  vendor_marketplace: "Freelance gig",
  directory: "Directory",
  search_result: "Search result",
};

/** "Listed on Job ad": the source a page of this kind counts as. */
export function docKindLabel(kind: string): string {
  return kind in SOURCE_FOR_DOC_KIND ? SOURCE_LABELS[SOURCE_FOR_DOC_KIND[kind as DocKind]] : kind;
}

/** How a piece of evidence was matched to its center. */
export const MERGE_LABELS: Record<MergeRule, string> = {
  new: "first record",
  domain: "matched by website",
  phone: "matched by phone",
  name_city: "matched by name and city",
};

/** Kinds of location signal, in plain words. */
export const SIGNAL_TYPE_LABELS: Record<CountrySignal["type"], string> = {
  phone: "phone prefix",
  city: "city",
  tld: "domain ending",
  job_board: "local job board",
  ai: "text mentions",
};
