import { CAMPAIGNS, type CampaignId } from "@/config/campaigns";
import { RED_FLAG_KEYWORDS } from "@/config/signals";
import { matchCampaign } from "@/lib/campaign-match";
import { findPhrase, foldAccents } from "@/lib/text";

export type QuoteVerdict = "ok" | "keyword_missing" | "negated_or_excluded";

const NEGATION = /\b(no|not|never|non|don't|do not|we don't|without|sin|ningun|ninguna|nunca)\b/;

/** "never shared, never recycled, never resold": a negation shortly before the keyword. */
function negatedBefore(folded: string, index: number): boolean {
  return NEGATION.test(folded.slice(Math.max(0, index - 30), index));
}

/**
 * In a job ad, "candidates with Medicare experience" or "experience in Final
 * Expense preferred" is what the employer asks for, not a campaign it runs.
 * ("An experienced Final Expense closer" is a job title and still counts.)
 * Spanish too: "experiencia en Obamacare", "asesores con experiencia en seguros".
 * "Con o sin experiencia" (no experience needed) doesn't trigger it.
 */
const EXPERIENCE_REQUIREMENT = new RegExp(
  [
    // English
    String.raw`\b(candidates|applicants)\s+(with|having)\b`,
    String.raw`\b(agents|people)\s+with\b[^.]{0,80}\bexperience\b`,
    String.raw`\bexperience\s+(in|with|of)\b`,
    String.raw`\b(prior|previous)\b[^.]{0,30}\bexperience\b`,
    String.raw`\bexperience\b[^.]{0,15}\b(required|preferred|a plus|apply)\b`,
    // Spanish (accents already folded)
    String.raw`\b(candidatos|postulantes|aspirantes|personas)\s+con\b`,
    String.raw`(?<!\bsin )\bexperiencia\s+(en|con|de|previa|minima|comprobada|demostrable)\b`,
    String.raw`\b(se requiere|requisito|indispensable|deseable)\b[^.]{0,30}\bexperiencia\b`,
  ].join("|"),
  "i",
);

/**
 * Does this quote really show the campaign? It must name it, without a
 * negation in front ("we don't do Medicare") and without an excluded context
 * ("Medicare biller", "medical billing"). Used when claims are verified, and
 * again when scoring, so evidence saved under older rules is judged the same way.
 */
export function campaignQuoteVerdict(campaign: CampaignId, quote: string, inJobAd = false): QuoteVerdict {
  const match = matchCampaign(campaign, quote);
  if (!match) return "keyword_missing";
  const folded = foldAccents(quote);
  if (CAMPAIGNS[campaign].negativeKeywords.some((n) => findPhrase(folded, n) !== -1)) return "negated_or_excluded";
  if (inJobAd && EXPERIENCE_REQUIREMENT.test(folded)) return "negated_or_excluded";
  return negatedBefore(folded, match.index) ? "negated_or_excluded" : "ok";
}

/**
 * Offshore centers name the US all the time because it is their market: "night shift (U.S.
 * hours)", "for US agencies", "our USA campaign", "Serving US, UK, EU clients". None of that says
 * where the center is, so a US location needs a quote that reads like a place: an address
 * ("Houston, TX 77056"), a state ("Tampa, Florida"), "located/based in", an office, or a
 * "US-based call center". The same idea as +1 numbers never counting as a location.
 */
const US_STATES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida", "georgia",
  "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland",
  "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire",
  "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania",
  "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington",
  "west virginia", "wisconsin", "wyoming", "district of columbia",
];
const STATE_CODES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
/** "Houston, TX" or "TX 77056"; upper case only, so "us, uk, eu, ca" isn't read as California. */
const US_ADDRESS = new RegExp(String.raw`\b[A-Z][a-z]+,\s*(?:${STATE_CODES})\b|\b(?:${STATE_CODES})\s+\d{5}\b`);
const PLACED =
  /\b(?:located|based|headquartered|registered|incorporated)\s+(?:in|at|out of)\b|\b(?:offices?|hq|headquarters|address)\b|\bu\.?\s?s\.?(?:a\.?)?-based\s+(?:call cent(?:er|re)|contact cent(?:er|re)|company|bpo|agency|firm|team)\b/;

/** Does this quote really place the center in the country? Only US mentions are checked (see above). */
export function countryQuoteVerdict(countryId: string | undefined, quote: string): QuoteVerdict {
  if (countryId !== "us") return "ok";
  const folded = foldAccents(quote);
  const placed = US_ADDRESS.test(quote) || PLACED.test(folded) || US_STATES.some((state) => findPhrase(folded, state) !== -1);
  return placed ? "ok" : "keyword_missing";
}

/**
 * A red flag counts only if it's one of our categories, one of its keywords appears, and it isn't
 * negated ("100% exclusive, never resold"). Categories the AI makes up ("age requirement") don't count.
 */
export function redFlagQuoteVerdict(value: string, quote: string): QuoteVerdict {
  const keywords = RED_FLAG_KEYWORDS.find((r) => r.value === value)?.keywords;
  if (!keywords) return "keyword_missing";
  const folded = foldAccents(quote);
  const positions = keywords.map((k) => findPhrase(folded, k)).filter((i) => i !== -1);
  if (positions.length === 0) return "keyword_missing";
  return positions.every((i) => negatedBefore(folded, i)) ? "negated_or_excluded" : "ok";
}
