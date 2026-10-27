import { CAMPAIGNS, type CampaignId } from "@/config/campaigns";
import { countryLabel } from "@/config/countries";
import { MARKETS, type MarketFilter } from "@/config/markets";

export function campaignLabel(id: string): string {
  return id in CAMPAIGNS ? CAMPAIGNS[id as CampaignId].label : id;
}

export function marketLabel(id: MarketFilter | string): string {
  return id === "any" ? "any" : id in MARKETS ? MARKETS[id as keyof typeof MARKETS].label : id;
}

/** "Final expense call centers in Pakistan, Spanish (US Hispanic) market" */
export function describeSearch(s: { campaign: string; country: string; market: string }): string {
  const where = s.country === "any" ? "anywhere" : `in ${countryLabel(s.country)}`;
  const market = s.market === "any" ? "" : `, ${marketLabel(s.market)} market`;
  return `${campaignLabel(s.campaign)} call centers ${where}${market}`;
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
