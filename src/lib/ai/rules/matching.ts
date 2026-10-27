import { ROLE_KEYWORDS, type CampaignRole } from "@/config/campaigns";
import { TUNED_COUNTRIES, TUNED_COUNTRY_IDS } from "@/config/countries";
import { findPhrase, foldAccents, sentenceAround } from "@/lib/text";

// Shared text helpers for the keyword rules. `folded` is always `foldAccents(text)`.

/** Quote = the sentence around the match, taken from the original text so it verifies. */
export function quoteAt(text: string, folded: string, phrase: string): string | null {
  const index = findPhrase(folded, phrase);
  return index === -1 ? null : sentenceAround(text, index);
}

export function firstMatch(text: string, folded: string, phrases: readonly string[]): { phrase: string; quote: string } | null {
  for (const phrase of phrases) {
    const quote = quoteAt(text, folded, phrase);
    if (quote) return { phrase, quote };
  }
  return null;
}

export function guessRole(folded: string): CampaignRole {
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (keywords.some((k) => findPhrase(folded, k) !== -1)) return role as CampaignRole;
  }
  return "unknown";
}

export function lettersOnly(text: string): string {
  return foldAccents(text).replace(/[^a-z0-9]/g, "");
}

/** Every city of the tuned countries, accent-folded. */
export const ALL_CITIES = TUNED_COUNTRY_IDS.flatMap((id) => TUNED_COUNTRIES[id].cities.map((c) => foldAccents(c)));

/** The most-mentioned known city (earliest mention breaks ties), not just the first in the config list. */
export function findCity(folded: string): { city: string; country: string; quote: string } | null {
  let best: { city: string; country: string; count: number; first: number } | null = null;
  for (const id of TUNED_COUNTRY_IDS) {
    for (const city of TUNED_COUNTRIES[id].cities) {
      const first = findPhrase(folded, city);
      if (first === -1) continue;
      const count = folded.split(foldAccents(city)).length - 1;
      if (!best || count > best.count || (count === best.count && first < best.first)) {
        best = { city, country: TUNED_COUNTRIES[id].label, count, first };
      }
    }
  }
  return best ? { city: best.city, country: best.country, quote: best.city } : null;
}
