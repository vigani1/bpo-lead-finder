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
 * ("Medicare biller", "medical billing"). Used by the keyword rules and when
 * claims are verified.
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
