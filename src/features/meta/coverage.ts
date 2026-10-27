import type { CampaignId } from "@/config/campaigns";
import { COVERAGE_HINTS, tunedCountry, UNTESTED_HINT, type Coverage, type CountryFilter } from "@/config/countries";

/** What to expect for a filter combination, from the feasibility check. Safe to use in the browser. */
export function coverageFor(country: CountryFilter, campaign: CampaignId): { coverage: Coverage | null; hint: string; note?: string } {
  if (country === "any") return { coverage: null, hint: "Searches globally; results lean towards Pakistan and the Philippines." };
  const config = tunedCountry(country);
  if (!config?.coverage) return { coverage: null, hint: UNTESTED_HINT };
  const coverage = config.coverage[campaign];
  return { coverage, hint: COVERAGE_HINTS[coverage], note: config.note };
}
