/**
 * Fit score weights. The score is the share of applicable points a center
 * earns (0–100), so "Any country" or "Any market" searches aren't penalised
 * for signals that don't apply. Change weights here; nothing else needs editing.
 */
export const SIGNAL_POINTS = {
  /**
   * The strongest proof that the center runs the requested campaign. Only the
   * best one counts, so a center needs a job ad OR its own website, not both:
   */
  /** …a job ad that names this employer for the campaign: proves the campaign is active now. */
  campaignFromJobAd: 30,
  /** …a service page on the center's own website. */
  campaignFromOwnSite: 25,
  /** …only a mention: a job-listing page naming many employers, a blog article, a social post or a gig. */
  campaignMention: 10,
  /** Bonus: the campaign is shown by two kinds of source (e.g. a job ad and the website). */
  corroborated: 10,
  /** Two or more distinct job ads (after clustering reposts) within the recency window. */
  severalJobAds: 5,
  /** Located in the requested country, backed by 2+ kinds of signal. */
  countryConfirmed: 15,
  /** Located in the requested country, 1 kind of signal. */
  countryLikely: 7,
  /** Serves the requested market (Spanish / bilingual). */
  servesMarket: 10,
  /** Sales, live transfers or appointment setting on the campaign (not service-only). */
  revenueRole: 5,
  /** Found in 2+ independent kinds of source. */
  independentSources: 10,
  /** Has a business phone, email or website. */
  hasContact: 5,
  /** Compliance / buyer-trust language: TCPA, DNC, consent proof, recordings. One line, so it can't outweigh a red flag. */
  complianceLanguage: 5,
  /** Job ads mention night shift / US hours. */
  usHours: 3,
} as const;

export const PENALTY_POINTS = {
  /** Every piece of evidence comes from a freelance marketplace gig. */
  vendorListingOnly: -10,
  /** Advertises shared / resold / aged transfers: buyers' top complaint, and against Medicare's one-to-one consent rule. */
  resoldTransfers: -20,
  /** Any other red flag (DME / genetic-testing campaigns, benefit bait). */
  redFlag: -20,
} as const;

export const CONFIDENCE_THRESHOLDS = {
  /** High also needs direct proof: a job ad naming the center, or its own website. A mention alone never makes High. */
  high: { minScore: 70 },
  medium: { minScore: 40 },
} as const;

export const RECENCY = {
  /** Evidence younger than this counts fully. */
  fullWeightDays: 90,
  /** Between full and this, evidence counts half; older counts zero. */
  halfWeightDays: 180,
} as const;

export const EVIDENCE_AGE_OPTIONS = [30, 90, 180] as const;
