export const CAMPAIGN_IDS = ["medicare", "aca", "final_expense", "life"] as const;
export type CampaignId = (typeof CAMPAIGN_IDS)[number];

export interface CampaignConfig {
  id: CampaignId;
  label: string;
  /** The label inside a sentence: proper names stay capitalised ("Works on Medicare", "Works on final expense"). */
  inSentence: string;
  /** Phrases that prove the campaign when found in text (lowercase, matched on word boundaries). */
  keywords: string[];
  /** Phrases that look like a match but are not this campaign. */
  negativeKeywords: string[];
  /** Terms used to build search queries. */
  searchTerms: { en: string[]; es: string[] };
}

export const CAMPAIGNS: Record<CampaignId, CampaignConfig> = {
  medicare: {
    id: "medicare",
    label: "Medicare",
    inSentence: "Medicare",
    keywords: ["medicare", "medicare advantage", "medicare supplement", "medigap", "part d"],
    // Healthcare admin jobs and provider work mention Medicare but aren't insurance campaigns.
    negativeKeywords: [
      "medicare clinic",
      "medicare hospital",
      "medicare pharmacy",
      "medical billing",
      "ar calling",
      "biller",
      "billing specialist",
      "medical coding",
      "medical coder",
      "home health",
      "scheduler",
      "credentialing",
      "prior authorization",
      "icd-10",
      "cpt codes",
      "pharmacies",
    ],
    searchTerms: { en: ["Medicare"], es: ["Medicare"] },
  },
  aca: {
    id: "aca",
    label: "ACA (Obamacare)",
    inSentence: "ACA (Obamacare)",
    // Never bare "ACA": it matches ACA International (debt collectors) and accounting bodies.
    keywords: [
      "obamacare",
      "affordable care act",
      "aca health",
      "aca insurance",
      "aca campaign",
      "aca transfers",
      "aca live transfers",
      "aca self closers",
      "aca enrollment",
      "health insurance marketplace",
      "u65",
    ],
    negativeKeywords: ["aca international", "acca", "chartered accountants"],
    searchTerms: { en: ["Obamacare", "ACA health insurance"], es: ["Obamacare"] },
  },
  final_expense: {
    id: "final_expense",
    label: "Final expense",
    inSentence: "final expense",
    keywords: [
      "final expense",
      "burial insurance",
      "burial policy",
      "funeral insurance",
      "fe campaign",
      "fe closer",
      "fe closers",
      "fe verifier",
      "fe transfers",
      "seguros exequiales",
      "seguro exequial",
    ],
    negativeKeywords: [],
    searchTerms: { en: ["final expense"], es: ["seguros exequiales", "final expense"] },
  },
  life: {
    id: "life",
    label: "Life insurance",
    inSentence: "life insurance",
    keywords: ["life insurance", "term life", "whole life", "indexed universal life", "seguro de vida", "seguros de vida"],
    // Domestic insurers that dominate "life insurance" results in Pakistan and India.
    negativeKeywords: [
      "state life insurance",
      "jubilee life",
      "efu life",
      "adamjee life",
      "life insurance corporation of india",
      "employee benefits",
    ],
    searchTerms: { en: ["life insurance"], es: ["seguros de vida"] },
  },
};

export const CAMPAIGN_ROLES = ["sales", "live_transfer", "appointment_setting", "customer_service", "unknown"] as const;
export type CampaignRole = (typeof CAMPAIGN_ROLES)[number];

export const ROLE_LABELS: Record<CampaignRole, string> = {
  sales: "Sales / closing",
  live_transfer: "Live transfers",
  appointment_setting: "Appointment setting",
  customer_service: "Customer service",
  unknown: "Unknown role",
};

/** Keywords used by the rules classifier to guess the campaign role. */
export const ROLE_KEYWORDS: Record<Exclude<CampaignRole, "unknown">, string[]> = {
  sales: ["closer", "closers", "closing", "sales agent", "sales representative", "sales rep", "licensed agent", "agente de ventas"],
  live_transfer: ["live transfer", "live transfers", "warm transfer", "fronter", "fronters", "opener", "verifier", "verifiers", "qualifier", "transferencias"],
  appointment_setting: ["appointment setter", "appointment setting", "agendamiento de citas"],
  customer_service: ["customer service", "member services", "customer support", "servicio al cliente", "enrollment support"],
};
