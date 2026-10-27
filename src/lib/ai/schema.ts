import { z } from "zod";
import { CAMPAIGN_IDS, CAMPAIGN_ROLES } from "@/config/campaigns";
import { MARKET_IDS } from "@/config/markets";
import { RED_FLAG_KEYWORDS } from "@/config/signals";

const RED_FLAG_VALUES = RED_FLAG_KEYWORDS.map((r) => r.value) as [string, ...string[]];

export const ENTITY_TYPES = [
  "call_center",
  "enterprise_bpo",
  "staffing_agency",
  "individual_freelancer",
  "lead_reseller",
  "us_insurance_agency",
  "lead_marketplace",
  "job_board",
  "directory",
  "other",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Entity types that count as a call center we can partner with. */
export const CENTER_ENTITY_TYPES: EntityType[] = ["call_center", "enterprise_bpo"];

export const ENTITY_LABELS: Record<EntityType, string> = {
  call_center: "Call center",
  enterprise_bpo: "Enterprise BPO",
  staffing_agency: "Staffing / recruiting agency",
  individual_freelancer: "Individual freelancer",
  lead_reseller: "Lead reseller",
  us_insurance_agency: "US insurance agency",
  lead_marketplace: "Lead marketplace",
  job_board: "Job board",
  directory: "Directory / listicle",
  other: "Other",
};

const quote = z.string().describe("Copied word for word from the document. Never paraphrase.");

/**
 * What the classifier returns for one document. Facts only, never scores.
 * Every claim carries a verbatim quote that code later checks against the text.
 * (No min/max constraints: structured outputs don't support them.)
 */
export const classificationSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityTypeQuote: quote.nullable(),
  companyName: z.string().nullable().describe("The company the document is about. For job ads, the employer. Null if not named."),
  city: z.string().nullable(),
  campaigns: z.array(
    z.object({
      campaign: z.enum([...CAMPAIGN_IDS, "other"]),
      role: z.enum(CAMPAIGN_ROLES),
      quote,
    }),
  ),
  markets: z.array(z.object({ market: z.enum(MARKET_IDS), quote })),
  countrySignals: z.array(z.object({ country: z.string().describe("Country name"), quote })),
  complianceSignals: z.array(z.object({ value: z.string(), quote })),
  redFlags: z.array(z.object({ value: z.enum(RED_FLAG_VALUES), quote })),
  usHours: z.object({ quote }).nullable().describe("Night shift / US hours mentioned"),
  summary: z.string().nullable().describe("One neutral sentence about what the company does."),
});

export type Classification = z.infer<typeof classificationSchema>;
