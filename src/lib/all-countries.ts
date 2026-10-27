import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js/max";
import { countryLabel, tunedCountry, type CountryConfig, type CountryId } from "@/config/countries";

/**
 * Every country, from libphonenumber's list. The six tuned countries keep their
 * hand-made settings; the rest get a phone prefix, domain ending, time zone and
 * search language derived here. Server-side only: libphonenumber is large.
 */

/** Phone-only regions in libphonenumber that aren't countries (Ascension, Tristan da Cunha). */
const NOT_COUNTRIES = new Set(["AC", "TA"]);

export const ALL_COUNTRY_IDS: CountryId[] = getCountries()
  .filter((code) => !NOT_COUNTRIES.has(code))
  .map((code) => code.toLowerCase())
  .sort((a, b) => countryLabel(a).localeCompare(countryLabel(b)));

const KNOWN = new Set(ALL_COUNTRY_IDS);

export function isCountryId(id: string): boolean {
  return KNOWN.has(id);
}

/** Spanish-speaking countries are searched in Spanish too. */
const SPANISH = new Set(["ar", "bo", "cl", "co", "cr", "cu", "do", "ec", "es", "gq", "gt", "hn", "mx", "ni", "pa", "pe", "pr", "py", "sv", "uy", "ve"]);

/** Country domain endings sold worldwide as generic names (.io, .ai, .tv…): they say nothing about location. */
const GENERIC_TLDS = new Set(["ac", "ag", "ai", "am", "bz", "cc", "cd", "cf", "cx", "fm", "ga", "gg", "gq", "gs", "im", "io", "la", "ly", "me", "ml", "mu", "nu", "pw", "sc", "sh", "so", "st", "tk", "to", "tv", "vc", "ws"]);

/** Big countries span several zones; show the main business hub's clock. */
const MAIN_TIME_ZONE: Record<string, string> = {
  us: "America/New_York",
  ca: "America/Toronto",
  br: "America/Sao_Paulo",
  au: "Australia/Sydney",
  ru: "Europe/Moscow",
  id: "Asia/Jakarta",
  cn: "Asia/Shanghai",
  ar: "America/Argentina/Buenos_Aires",
  cl: "America/Santiago",
  ec: "America/Guayaquil",
  es: "Europe/Madrid",
  pt: "Europe/Lisbon",
  kz: "Asia/Almaty",
  xk: "Europe/Belgrade",
};

function timeZoneOf(id: string): string | undefined {
  if (MAIN_TIME_ZONE[id]) return MAIN_TIME_ZONE[id];
  try {
    const locale = new Intl.Locale(`und-${id.toUpperCase()}`) as Intl.Locale & { getTimeZones?: () => string[]; timeZones?: string[] };
    return (locale.getTimeZones?.() ?? locale.timeZones)?.[0];
  } catch {
    return undefined;
  }
}

const derived = new Map<string, CountryConfig>();

/** Settings for any country: tuned if we have them, otherwise derived. */
export function getCountry(id: string): CountryConfig | undefined {
  const tuned = tunedCountry(id);
  if (tuned) return tuned;
  if (!isCountryId(id)) return undefined;
  let config = derived.get(id);
  if (!config) {
    const tld = id === "gb" ? "uk" : id;
    config = {
      id,
      tuned: false,
      label: countryLabel(id),
      iso2: id.toUpperCase(),
      phoneCode: getCountryCallingCode(id.toUpperCase() as CountryCode),
      tlds: GENERIC_TLDS.has(tld) ? [] : [tld],
      cities: [],
      timeZone: timeZoneOf(id),
      language: SPANISH.has(id) ? "es" : "en",
      hiringTerms: [],
      coverage: null,
    };
    derived.set(id, config);
  }
  return config;
}

/** Country for a libphonenumber region code ("PK" → "pk"). */
export function countryFromIso2(iso2: string | undefined): CountryId | undefined {
  const id = iso2?.toLowerCase();
  return id && isCountryId(id) ? id : undefined;
}

/** Country whose domain ending this is (".pk" → "pk"); generic endings like .io give nothing. */
export function countryFromTld(tld: string | undefined): CountryId | undefined {
  if (!tld) return undefined;
  if (tld === "uk") return "gb";
  return getCountry(tld)?.tlds.includes(tld) ? tld : undefined;
}

/** Other names the AI uses for a country. */
export const COUNTRY_NAME_ALIASES: Record<string, CountryId> = {
  usa: "us",
  "united states of america": "us",
  america: "us",
  uk: "gb",
  england: "gb",
  "great britain": "gb",
};
