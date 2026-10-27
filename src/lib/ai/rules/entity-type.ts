import { ENTITY_HINTS } from "@/config/signals";
import type { Doc } from "@/lib/pipeline/types";
import { findPhrase, foldAccents } from "@/lib/text";
import type { EntityType } from "../schema";
import { firstMatch, quoteAt } from "./matching";

/**
 * Weighs all hints instead of trusting the first one: a "Get a quote" button
 * or a "staffing" service line shouldn't turn a call center into an agency.
 * A non-center type wins only with 2+ distinct hints and more than call_center.
 */
export function guessEntityType(doc: Doc, folded: string): { type: EntityType; quote: string | null } {
  if (doc.kind === "vendor_listing") {
    const hit = firstMatch(doc.text, folded, ENTITY_HINTS.call_center);
    // A gig that describes a center ("7 call center locations") is a reseller at best.
    return hit ? { type: "lead_reseller", quote: hit.quote } : { type: "individual_freelancer", quote: null };
  }
  if (doc.kind === "listing") return { type: "directory", quote: null };

  const hits = (Object.keys(ENTITY_HINTS) as (keyof typeof ENTITY_HINTS)[]).map((type) => ({
    type,
    phrases: ENTITY_HINTS[type].filter((h) => findPhrase(folded, h.trim()) !== -1),
  }));
  const center = hits.find((h) => h.type === "call_center")!;
  const strongestOther = hits
    .filter((h) => h.type !== "call_center" && h.phrases.length >= 2)
    .sort((a, b) => b.phrases.length - a.phrases.length)[0];

  if (strongestOther && strongestOther.phrases.length > center.phrases.length) {
    return { type: strongestOther.type, quote: quoteAt(doc.text, folded, strongestOther.phrases[0]!.trim()) };
  }
  if (center.phrases.length > 0) return { type: "call_center", quote: quoteAt(doc.text, folded, center.phrases[0]!) };
  // A job ad naming an insurance campaign is almost always posted by a center.
  return doc.kind === "job_ad" ? { type: "call_center", quote: null } : { type: "other", quote: null };
}

/**
 * Companies on the other side of the deal (they buy leads from call centers or
 * hand them campaigns) describe themselves much like centers do, and the model
 * sometimes calls them one. Two or more distinct buyer phrases on the page
 * ("connects call centers…", "BPO projects", "campaign provider") overrule it.
 */
export function looksLikeCampaignBuyer(text: string): boolean {
  const folded = foldAccents(text);
  return ENTITY_HINTS.campaign_buyer.filter((h) => findPhrase(folded, h) !== -1).length >= 2;
}
