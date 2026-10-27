import { CAMPAIGNS, type CampaignId } from "@/config/campaigns";
import { findPhrase, foldAccents } from "@/lib/text";

/**
 * "ACA" on its own is ambiguous (ACA International is a debt-collection body),
 * so it only counts in capitals AND next to another insurance campaign, as in
 * "Medicare, ACA, Final Expense" or "ACA & Medicare campaigns".
 */
const BARE_ACA = /\bACA\b/;
const INSURANCE_NEIGHBOURS = /\b(medicare|final expense|obamacare|u65|health insurance|life insurance|auto insurance|insurance campaigns?|ssdi)\b/i;

export interface CampaignMatch {
  keyword: string;
  /** Where the match starts, in the accent-folded text (same position as the original for normal accented letters). */
  index: number;
}

/** Finds the first phrase in `text` that shows this campaign (shared by the rules classifier and claim verification). */
export function matchCampaign(campaign: CampaignId, text: string): CampaignMatch | null {
  const folded = foldAccents(text);
  for (const keyword of CAMPAIGNS[campaign].keywords) {
    const index = findPhrase(folded, keyword);
    if (index !== -1) return { keyword, index };
  }
  if (campaign === "aca") {
    const bare = BARE_ACA.exec(text);
    if (bare) {
      const window = text.slice(Math.max(0, bare.index - 60), bare.index + 60);
      if (INSURANCE_NEIGHBOURS.test(window)) return { keyword: "ACA", index: bare.index };
    }
  }
  return null;
}
