import { CAMPAIGNS, type CampaignId, type CampaignRole } from "@/config/campaigns";
import { MARKETS, type MarketId } from "@/config/markets";
import type { Classification } from "@/lib/ai/schema";
import { matchCampaign } from "@/lib/campaign-match";
import { campaignQuoteVerdict, redFlagQuoteVerdict } from "@/lib/claim-checks";
import { findPhrase, foldAccents, normalizeForMatch, sentenceAround } from "@/lib/text";
import type { Doc } from "./types";

export interface VerifiedClaim {
  kind: "campaign" | "market" | "country" | "compliance" | "red_flag" | "us_hours" | "entity";
  value: string;
  role?: CampaignRole;
  quote: string;
  matchType: "exact" | "normalized";
  /** The page the quote was found on. */
  url: string;
}

export interface VerificationResult {
  claims: VerifiedClaim[];
  checked: number;
  dropped: { quote: string; reason: "not_in_document" | "too_long" | "keyword_missing" | "negated_or_excluded" }[];
}

/**
 * A quote is a sentence or two, not a page. Longer ones are dropped: they prove nothing a short one
 * wouldn't, and a stored quote must fit Postgres's index on evidence (about 2,700 bytes per row).
 * The limit is checked here, not in the AI's answer schema: strict structured output doesn't support it.
 */
const MAX_QUOTE_CHARS = 500;

/**
 * Locates a quote in the document. Exact first, then after normalization
 * (Unicode, invisible chars, curly quotes, whitespace, case). Returns the URL
 * of the page that contains it, or null when the quote isn't really there.
 */
function locate(doc: Doc, quote: string): { url: string; matchType: "exact" | "normalized" } | null {
  // An empty quote is "in" every text, so very short quotes prove nothing.
  const needle = normalizeForMatch(quote);
  if (needle.length < 4) return null;
  const pages = doc.pages?.length ? doc.pages : [{ url: doc.url, text: doc.text }];
  for (const page of pages) if (page.text.includes(quote)) return { url: page.url, matchType: "exact" };
  for (const page of pages) if (normalizeForMatch(page.text).includes(needle)) return { url: page.url, matchType: "normalized" };
  return null;
}

function supportsMarket(market: MarketId, quote: string): boolean {
  const folded = foldAccents(quote);
  return MARKETS[market].keywords.some((k) => findPhrase(folded, k) !== -1);
}

/**
 * The AI (or rules) only proposes claims. Code decides what's kept: the quote
 * must really be in the document, and campaign, market and red-flag quotes must
 * contain a matching keyword without a negation in front of it.
 */
/**
 * The model named a campaign but quoted a sentence that doesn't ("agents make
 * outbound calls…"). On a website page that is about that campaign, because its
 * address names it (/life-insurance-campaign-call-center/), the page's own
 * sentence that names the campaign is used instead, if it passes the same
 * checks. Only the address decides, so a menu or an "industries we serve" list
 * on some other page can't turn into proof.
 */
function campaignSentenceOnPage(doc: Doc, url: string, campaign: CampaignId): string | null {
  if (doc.kind !== "website") return null;
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname).replace(/[-_/]+/g, " ");
  } catch {
    return null;
  }
  if (!matchCampaign(campaign, path)) return null;
  const text = doc.pages?.find((p) => p.url === url)?.text ?? doc.text;
  const folded = foldAccents(text);
  for (const keyword of CAMPAIGNS[campaign].keywords) {
    for (let from = 0, i = findPhrase(folded, keyword); i !== -1; i = findPhrase(folded.slice(from), keyword)) {
      const sentence = sentenceAround(text, from + i);
      if (sentence.length >= 20 && campaignQuoteVerdict(campaign, sentence) === "ok" && locate(doc, sentence)) return sentence;
      from += i + keyword.length;
    }
  }
  return null;
}

export function verifyClaims(doc: Doc, classification: Classification): VerificationResult {
  const result: VerificationResult = { claims: [], checked: 0, dropped: [] };

  const keep = (
    claim: Omit<VerifiedClaim, "matchType" | "url">,
    check?: () => "ok" | VerificationResult["dropped"][number]["reason"],
    rescue?: (url: string) => string | null,
  ) => {
    result.checked++;
    if (claim.quote.length > MAX_QUOTE_CHARS) {
      result.dropped.push({ quote: claim.quote, reason: "too_long" });
      return;
    }
    const where = locate(doc, claim.quote);
    if (!where) {
      result.dropped.push({ quote: claim.quote, reason: "not_in_document" });
      return;
    }
    const verdict = check?.() ?? "ok";
    const rescued = verdict === "keyword_missing" ? rescue?.(where.url) : null;
    if (rescued) {
      result.claims.push({ ...claim, quote: rescued, ...locate(doc, rescued)! });
      return;
    }
    if (verdict !== "ok") {
      result.dropped.push({ quote: claim.quote, reason: verdict });
      return;
    }
    result.claims.push({ ...claim, ...where });
  };

  for (const c of classification.campaigns) {
    if (c.campaign === "other") continue;
    const campaign = c.campaign;
    keep(
      { kind: "campaign", value: campaign, role: c.role, quote: c.quote },
      () => campaignQuoteVerdict(campaign, c.quote, doc.kind === "job_ad"),
      (url) => campaignSentenceOnPage(doc, url, campaign),
    );
  }
  for (const m of classification.markets) {
    if (m.market === "english") continue;
    keep({ kind: "market", value: m.market, quote: m.quote }, () => (supportsMarket(m.market, m.quote) ? "ok" : "keyword_missing"));
  }
  for (const s of classification.countrySignals) keep({ kind: "country", value: s.country, quote: s.quote });
  for (const s of classification.complianceSignals) keep({ kind: "compliance", value: s.value, quote: s.quote });
  for (const s of classification.redFlags) keep({ kind: "red_flag", value: s.value, quote: s.quote }, () => redFlagQuoteVerdict(s.value, s.quote));
  if (classification.usHours) keep({ kind: "us_hours", value: "us_hours", quote: classification.usHours.quote });
  if (classification.entityTypeQuote) keep({ kind: "entity", value: classification.entityType, quote: classification.entityTypeQuote });

  return result;
}
