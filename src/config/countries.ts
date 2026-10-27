import type { CampaignId } from "./campaigns";

/**
 * Countries with hand-tuned search settings, from the feasibility check. Every
 * other country works too, with settings derived automatically (all-countries.ts).
 * This file stays free of large libraries so the browser can import it.
 */
export const TUNED_COUNTRY_IDS = ["pk", "ph", "in", "co", "mx", "do"] as const;
export type TunedCountryId = (typeof TUNED_COUNTRY_IDS)[number];
/** Lowercase ISO 3166-1 alpha-2 code, such as "pk" or "jm". */
export type CountryId = string;
/** "any" is a filter value only; a center always has a concrete country or none. */
export type CountryFilter = CountryId | "any";

/** How much public data exists, from the hands-on feasibility check (2026-10-26). */
export type Coverage = "strong" | "workable" | "weak" | "none";

export interface CountryConfig {
  id: CountryId;
  /** True for the hand-tuned countries above. */
  tuned: boolean;
  label: string;
  /** For tight spaces like the home page clocks. */
  shortLabel?: string;
  /** ISO 3166-1 alpha-2, as returned by libphonenumber. */
  iso2: string;
  phoneCode: string;
  tlds: string[];
  /** Main call-center city first; its clock is shown on the home page. Empty for untuned countries. */
  cities: string[];
  /** IANA time zone of the main call-center city, when known. */
  timeZone?: string;
  /** Value for Tavily's `country` boost parameter (only set where tested). */
  tavilyCountry?: string;
  language: "en" | "es";
  /** Local hiring vocabulary that surfaced named centers in the feasibility check. */
  hiringTerms: string[];
  /** How much public data was found in testing; null when the country wasn't tested. */
  coverage: Record<CampaignId, Coverage> | null;
  note?: string;
}

export const TUNED_COUNTRIES: Record<TunedCountryId, CountryConfig> = {
  pk: {
    id: "pk",
    tuned: true,
    label: "Pakistan",
    iso2: "PK",
    phoneCode: "92",
    tlds: ["pk"],
    cities: ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Hyderabad"],
    timeZone: "Asia/Karachi",
    tavilyCountry: "pakistan",
    language: "en",
    hiringTerms: ["closer", "verifier", "fronter", "night shift"],
    coverage: { medicare: "strong", aca: "strong", final_expense: "strong", life: "weak" },
  },
  ph: {
    id: "ph",
    tuned: true,
    label: "Philippines",
    iso2: "PH",
    phoneCode: "63",
    tlds: ["ph"],
    cities: ["Manila", "Makati", "Quezon City", "Pasig", "Taguig", "Cebu", "Davao", "Iloilo", "Bacolod", "Pampanga", "Clark", "Angeles"],
    timeZone: "Asia/Manila",
    tavilyCountry: "philippines",
    language: "en",
    hiringTerms: ["appointment setter", "outbound sales", "night shift"],
    coverage: { medicare: "workable", aca: "weak", final_expense: "workable", life: "weak" },
    note: "Campaign evidence is mostly in job ads, not on company websites.",
  },
  in: {
    id: "in",
    tuned: true,
    label: "India",
    iso2: "IN",
    phoneCode: "91",
    tlds: ["in"],
    cities: ["Mohali", "Noida", "Gurgaon", "Gurugram", "Delhi", "Ahmedabad", "Kolkata", "Mumbai", "Pune", "Chandigarh", "Jaipur", "Indore"],
    timeZone: "Asia/Kolkata",
    tavilyCountry: "india",
    language: "en",
    hiringTerms: ["US Medicare process", "US process", "night shift"],
    coverage: { medicare: "weak", aca: "weak", final_expense: "none", life: "none" },
    note: "Mostly large enterprise BPOs doing member services; many medical-billing false positives.",
  },
  co: {
    id: "co",
    tuned: true,
    label: "Colombia",
    iso2: "CO",
    phoneCode: "57",
    tlds: ["co"],
    cities: ["Bogotá", "Medellín", "Barranquilla", "Cali", "Bucaramanga", "Cartagena", "Pereira", "Armenia"],
    timeZone: "America/Bogota",
    tavilyCountry: "colombia",
    language: "es",
    hiringTerms: ["agente bilingüe", "call center bilingüe", "clientes EE. UU."],
    coverage: { medicare: "weak", aca: "workable", final_expense: "workable", life: "weak" },
    note: "Named centers appear mainly in Spanish job ads.",
  },
  mx: {
    id: "mx",
    tuned: true,
    label: "Mexico",
    iso2: "MX",
    phoneCode: "52",
    tlds: ["mx"],
    cities: ["Tijuana", "Guadalajara", "Monterrey", "Ciudad de México", "Mexico City", "Hermosillo", "Mérida", "Querétaro"],
    timeZone: "America/Tijuana",
    tavilyCountry: "mexico",
    language: "es",
    hiringTerms: ["agente bilingüe", "call center bilingüe"],
    coverage: { medicare: "weak", aca: "weak", final_expense: "none", life: "none" },
    note: "Only weak signals, mostly around Tijuana.",
  },
  do: {
    id: "do",
    tuned: true,
    label: "Dominican Republic",
    shortLabel: "Dominican Rep.",
    iso2: "DO",
    phoneCode: "1",
    tlds: ["do"],
    cities: ["Santo Domingo", "Santiago de los Caballeros", "Santiago"],
    timeZone: "America/Santo_Domingo",
    tavilyCountry: "dominican republic",
    language: "es",
    hiringTerms: ["agente bilingüe", "call center bilingüe"],
    coverage: { medicare: "none", aca: "none", final_expense: "none", life: "none" },
    note: "No insurance-specific public sources found in testing.",
  },
};

export const COVERAGE_HINTS: Record<Coverage, string> = {
  strong: "Lots of public data: expect several named centers.",
  workable: "Some public data: expect a handful of centers.",
  weak: "Little public data: expect few or weak matches.",
  none: "No public sources found in testing: expect empty results.",
};

export const UNTESTED_HINT = "Not tested yet: results depend on how much public data this country has.";

export function tunedCountry(id: string | null | undefined): CountryConfig | undefined {
  return id && id in TUNED_COUNTRIES ? TUNED_COUNTRIES[id as TunedCountryId] : undefined;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** English name for any country code: "jm" → "Jamaica". */
export function countryLabel(id: string | null | undefined): string {
  if (!id) return "Unknown";
  const tuned = tunedCountry(id);
  if (tuned) return tuned.label;
  try {
    return regionNames.of(id.toUpperCase()) ?? id.toUpperCase();
  } catch {
    return id.toUpperCase();
  }
}
