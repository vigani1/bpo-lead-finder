import { ALL_COUNTRY_IDS, COUNTRY_NAME_ALIASES, countryFromIso2, countryFromTld } from "@/lib/all-countries";
import { countryLabel, TUNED_COUNTRIES, TUNED_COUNTRY_IDS, type CountryId } from "@/config/countries";
import type { CountrySignal } from "@/lib/db/schema";
import { phoneCountry } from "@/lib/extract/phones";
import { foldAccents } from "@/lib/text";

/**
 * Weight per kind of signal. A phone prefix is the hardest to fake, except
 * US and Canadian numbers: offshore centers often show a virtual +1 number so
 * American clients can call them, so those never count as a location.
 */
const WEIGHTS: Record<CountrySignal["type"], number> = { phone: 3, job_board: 2, city: 2, tld: 2, ai: 1 };

const VIRTUAL_NUMBER_COUNTRIES = new Set(["us", "ca"]);

const LABEL_TO_ID = new Map<string, CountryId>([
  ...ALL_COUNTRY_IDS.flatMap((id): [string, CountryId][] => [
    [foldAccents(countryLabel(id)), id],
    [id, id],
  ]),
  ...Object.entries(COUNTRY_NAME_ALIASES),
]);

export function countryIdFromName(name: string): CountryId | undefined {
  return LABEL_TO_ID.get(foldAccents(name.trim()));
}

/** Exact (accent-insensitive) city match; substring matching would turn "California" into Cali. */
export function cityCountry(city: string | null | undefined): CountryId | undefined {
  if (!city) return undefined;
  const folded = foldAccents(city.split(",")[0]!.trim());
  return TUNED_COUNTRY_IDS.find((id) => TUNED_COUNTRIES[id].cities.some((c) => foldAccents(c) === folded));
}

export function collectCountrySignals(input: {
  phones: string[];
  registeredDomain: string | null;
  boardCountry?: string;
  city: string | null;
  aiCountries: string[];
}): CountrySignal[] {
  const signals: CountrySignal[] = [];
  for (const phone of input.phones) {
    const country = countryFromIso2(phoneCountry(phone));
    if (country && !VIRTUAL_NUMBER_COUNTRIES.has(country)) signals.push({ type: "phone", value: phone.slice(0, 4), country });
  }
  const tld = input.registeredDomain?.split(".").at(-1);
  const tldCountry = countryFromTld(tld);
  if (tldCountry) signals.push({ type: "tld", value: `.${tld}`, country: tldCountry });
  if (input.boardCountry) signals.push({ type: "job_board", value: input.boardCountry, country: input.boardCountry });
  const fromCity = cityCountry(input.city);
  if (fromCity && input.city) signals.push({ type: "city", value: input.city, country: fromCity });
  for (const name of input.aiCountries) {
    const id = countryIdFromName(name);
    if (id) signals.push({ type: "ai", value: name, country: id });
  }
  return signals;
}

export interface CountryInference {
  country: string | null;
  /** Backed by 2+ different kinds of signal. */
  confirmed: boolean;
  kinds: CountrySignal["type"][];
}

export function inferCountry(signals: CountrySignal[]): CountryInference {
  const totals = new Map<string, { weight: number; kinds: Set<CountrySignal["type"]> }>();
  for (const s of signals) {
    const entry = totals.get(s.country) ?? { weight: 0, kinds: new Set() };
    if (!entry.kinds.has(s.type)) entry.weight += WEIGHTS[s.type];
    entry.kinds.add(s.type);
    totals.set(s.country, entry);
  }
  const best = [...totals.entries()].sort((a, b) => b[1].weight - a[1].weight)[0];
  if (!best) return { country: null, confirmed: false, kinds: [] };
  return { country: best[0], confirmed: best[1].kinds.size >= 2, kinds: [...best[1].kinds] };
}

export function mergeSignals(a: CountrySignal[], b: CountrySignal[]): CountrySignal[] {
  const merged = [...a];
  for (const s of b) {
    if (!merged.some((m) => m.type === s.type && m.value === s.value && m.country === s.country)) merged.push(s);
  }
  return merged;
}
