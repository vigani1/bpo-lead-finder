/**
 * Keyword lists for signals that aren't campaigns. Used by the rules
 * classifier, and as hints in the AI prompt.
 */

export const COMPLIANCE_KEYWORDS = [
  "tcpa",
  "dnc",
  "do not call",
  "dnc scrubbing",
  "litigator scrub",
  "trustedform",
  "jornaya",
  "call recording",
  "calls are recorded",
  "cms compliant",
  "cms guidelines",
  "consent",
  "exclusive transfers",
  "exclusive calls",
  "never resold",
];

/** The only red-flag categories that count; anything else the AI names is ignored. */
export const RED_FLAG_KEYWORDS: { value: "resold_transfers" | "benefit_bait" | "high_risk_campaigns"; keywords: string[] }[] = [
  { value: "resold_transfers", keywords: ["shared transfers", "shared leads", "resold", "aged leads"] },
  { value: "benefit_bait", keywords: ["$0 plan", "free cash card", "grocery allowance card", "free subsidy", "giveback benefit"] },
  { value: "high_risk_campaigns", keywords: ["dme", "durable medical equipment", "genetic testing", "covid test kits", "cgm"] },
];

export const US_HOURS_KEYWORDS = ["night shift", "us shift", "us hours", "est hours", "turno nocturno", "horario usa"];

/** Hints for the rules classifier's entity-type guess. */
export const ENTITY_HINTS = {
  call_center: ["call center", "call centre", "contact center", "contact centre", "bpo", "outsourcing", "campaigns", "seats", "fronter", "verifier", "closer"],
  individual_freelancer: ["i will ", "i am a", "my services", "freelancer", "hourly rate", "own pc", "own computer", "home-based"],
  staffing_agency: ["staffing", "recruitment agency", "recruiting agency", "manpower", "placement agency", "our client is", "on behalf of our client"],
  us_insurance_agency: ["licensed in all", "licensed in 50 states", "independent insurance agency", "get a quote", "insurance agency"],
  lead_marketplace: ["buy leads", "lead marketplace", "pay per call network", "ping post"],
} as const;

/** Employer names that mean "not named". */
export const HIDDEN_EMPLOYER_PATTERNS = [
  /^pvt\.? job$/i,
  /^confidential/i,
  /^importante empresa/i,
  /^empresa (confidencial|líder|lider)/i,
  /^(a |an )?(leading|reputed|well[- ]known) (company|bpo|call cent(er|re))/i,
  /^employer$/i,
  /^hiring$/i,
];
