import type { CampaignRole } from "@/config/campaigns";
import { MARKETS, type MarketId } from "@/config/markets";
import type { Classification } from "@/lib/ai/schema";
import { campaignQuoteVerdict, redFlagQuoteVerdict } from "@/lib/claim-checks";
import { findPhrase, foldAccents, normalizeForMatch } from "@/lib/text";
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
  dropped: { quote: string; reason: "not_in_document" | "keyword_missing" | "negated_or_excluded" }[];
}

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
export function verifyClaims(doc: Doc, classification: Classification): VerificationResult {
  const result: VerificationResult = { claims: [], checked: 0, dropped: [] };

  const keep = (claim: Omit<VerifiedClaim, "matchType" | "url">, check?: () => "ok" | VerificationResult["dropped"][number]["reason"]) => {
    result.checked++;
    const where = locate(doc, claim.quote);
    if (!where) {
      result.dropped.push({ quote: claim.quote, reason: "not_in_document" });
      return;
    }
    const verdict = check?.() ?? "ok";
    if (verdict !== "ok") {
      result.dropped.push({ quote: claim.quote, reason: verdict });
      return;
    }
    result.claims.push({ ...claim, ...where });
  };

  for (const c of classification.campaigns) {
    if (c.campaign === "other") continue;
    const campaign = c.campaign;
    keep({ kind: "campaign", value: campaign, role: c.role, quote: c.quote }, () => campaignQuoteVerdict(campaign, c.quote, doc.kind === "job_ad"));
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
