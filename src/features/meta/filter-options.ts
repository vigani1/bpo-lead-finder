import "server-only";
import { ALL_COUNTRY_IDS, getCountry } from "@/lib/all-countries";
import { CAMPAIGNS, CAMPAIGN_IDS, type CampaignId } from "@/config/campaigns";
import { TUNED_COUNTRY_IDS, tunedCountry, type CountryFilter } from "@/config/countries";
import { DEPTH_PRESETS, SEARCH_DEPTHS } from "@/config/limits";
import { MARKETS, MARKET_IDS } from "@/config/markets";

export interface CountryOption {
  id: CountryFilter;
  label: string;
  shortLabel?: string;
  /** Main call-center city, for the clock (tuned countries only). */
  city?: string;
  timeZone?: string;
  tuned: boolean;
}

export interface FilterOptions {
  /** "any" first, then every country; tuned ones are shown as clocks on the home page. */
  countries: CountryOption[];
  markets: { id: string; label: string }[];
  campaigns: { id: CampaignId; label: string }[];
  depths: { id: string; label: string; description: string }[];
}

export function getFilterOptions(): FilterOptions {
  // Tuned countries in their configured order, then the rest alphabetically.
  const ids = [...TUNED_COUNTRY_IDS, ...ALL_COUNTRY_IDS.filter((id) => !tunedCountry(id))];
  const countries = ids.flatMap((id): CountryOption[] => {
    const c = getCountry(id);
    return c ? [{ id, label: c.label, shortLabel: c.shortLabel, city: c.cities[0], timeZone: c.timeZone, tuned: c.tuned }] : [];
  });
  return {
    countries: [{ id: "any", label: "Any country", city: "New York", timeZone: "America/New_York", tuned: true }, ...countries],
    markets: [{ id: "any", label: "Any language" }, ...MARKET_IDS.map((id) => ({ id, label: MARKETS[id].label }))],
    campaigns: CAMPAIGN_IDS.map((id) => ({ id, label: CAMPAIGNS[id].label })),
    depths: SEARCH_DEPTHS.map((id) => ({ id, label: DEPTH_PRESETS[id].label, description: DEPTH_PRESETS[id].description })),
  };
}
