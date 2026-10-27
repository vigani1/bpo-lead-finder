import { CAMPAIGN_IDS } from "@/config/campaigns";
import { campaignQuoteVerdict } from "@/lib/claim-checks";
import { MARKETS } from "@/config/markets";
import { COMPLIANCE_KEYWORDS, RED_FLAG_KEYWORDS, US_HOURS_KEYWORDS } from "@/config/signals";
import { matchCampaign } from "@/lib/campaign-match";
import { foldAccents, sentenceAround } from "@/lib/text";
import type { Classification } from "../schema";
import { NO_USAGE, type Classifier } from "../types";
import { companyName } from "./company-name";
import { guessEntityType } from "./entity-type";
import { findCity, firstMatch, guessRole } from "./matching";

/**
 * Keyword rules: the fallback when no AI is configured. Deterministic and
 * explainable, but it can't read meaning — results are labelled "rules".
 */
export const rulesClassifier: Classifier = {
  id: "rules-v1",
  label: "Keyword rules (no AI)",
  async classify(doc) {
    const text = doc.text;
    const folded = foldAccents(text);
    const entity = guessEntityType(doc, folded);
    const named = doc.kind === "listing" ? null : companyName(doc);
    const role = guessRole(folded);

    const campaigns: Classification["campaigns"] = [];
    for (const id of CAMPAIGN_IDS) {
      const match = matchCampaign(id, text);
      if (!match) continue;
      const hit = { quote: sentenceAround(text, match.index) };
      const rejected = campaignQuoteVerdict(id, hit.quote, doc.kind === "job_ad") !== "ok";
      // The role named next to the campaign beats one guessed from the whole page.
      const nearRole = guessRole(foldAccents(hit.quote));
      if (!rejected) campaigns.push({ campaign: id, role: nearRole !== "unknown" ? nearRole : role, quote: hit.quote });
    }

    const markets: Classification["markets"] = [];
    for (const market of ["spanish", "bilingual"] as const) {
      const hit = firstMatch(text, folded, MARKETS[market].keywords);
      if (hit) markets.push({ market, quote: hit.quote });
    }

    const city = findCity(folded);
    const complianceHit = firstMatch(text, folded, COMPLIANCE_KEYWORDS);
    const usHours = firstMatch(text, folded, US_HOURS_KEYWORDS);

    const classification: Classification = {
      entityType: entity.type,
      // The sentence that names the company, so every name can be traced to its source.
      entityTypeQuote: named?.quote ?? null,
      companyName: named?.name ?? null,
      city: city?.city ?? null,
      campaigns,
      markets,
      countrySignals: city ? [{ country: city.country, quote: city.quote }] : [],
      complianceSignals: complianceHit ? [{ value: complianceHit.phrase, quote: complianceHit.quote }] : [],
      redFlags: RED_FLAG_KEYWORDS.flatMap(({ value, keywords }) => {
        const hit = firstMatch(text, folded, keywords);
        return hit ? [{ value, quote: hit.quote }] : [];
      }),
      usHours: usHours ? { quote: usHours.quote } : null,
      summary: null,
    };
    return { classification, classifierId: this.id, usage: NO_USAGE };
  },
};
