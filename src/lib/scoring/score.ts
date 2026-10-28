import type { CampaignId } from "@/config/campaigns";
import { labelFor, SIGNAL_TYPE_LABELS } from "@/lib/format";
import type { CountryFilter } from "@/config/countries";
import { marketMatches, type MarketFilter, type MarketId } from "@/config/markets";
import { dateFromUrl, isListingPageUrl, websitePageKind } from "@/lib/page-kinds";
import { CONFIDENCE_THRESHOLDS, PENALTY_POINTS, RECENCY, SIGNAL_POINTS } from "@/config/scoring";
import { matchCampaign } from "@/lib/campaign-match";
import { campaignQuoteVerdict, redFlagQuoteVerdict } from "@/lib/claim-checks";
import { normalizeForMatch } from "@/lib/text";

/** The evidence fields scoring needs (works for DB rows and JSON from the API). */
export interface ScoredEvidence {
  id: string;
  kind: string;
  value: string;
  campaignRole: string | null;
  quote: string;
  sourceUrl: string;
  source: string;
  postedAt: Date | string | null;
  seenAt: Date | string;
}

export interface ScoredCenter {
  country: string | null;
  countrySignals: { type: string; country: string }[];
  phones: string[];
  emails: string[];
  domain: string | null;
}

export interface ScoreLine {
  signal: string;
  label: string;
  points: number;
  /** Points available for this signal (0 for penalties). */
  max: number;
  evidenceIds: string[];
  /** Adds points when found but isn't counted in the points possible. */
  bonus?: boolean;
}

export type ConfidenceLabel = "high" | "medium" | "low";

export interface ScoreResult {
  score: number;
  label: ConfidenceLabel;
  /** Every applicable signal, earned or not, plus penalties: the full breakdown. */
  lines: ScoreLine[];
  independentSourceTypes: number;
  redFlags: string[];
  /** Why the label is lower than the score alone would give, if it is. */
  labelReason: string | null;
  /** Points earned minus penalties, and points possible (bonuses left out): score = earned ÷ possible. */
  earned: number;
  possible: number;
}

export interface ScoreOptions {
  campaign: CampaignId;
  country: CountryFilter;
  market: MarketFilter;
  /** Ignore evidence older than this (null = any age). */
  maxEvidenceAgeDays: number | null;
  now: Date;
}

const DAY = 86_400_000;

/** Age of the evidence: the posting date, else a date in the URL ("/2011/09/"), else when we saw it. */
function ageDays(e: ScoredEvidence, now: Date): number {
  const when = new Date(e.postedAt ?? dateFromUrl(e.sourceUrl) ?? e.seenAt).getTime();
  return Math.max(0, (now.getTime() - when) / DAY);
}

/** Full weight when recent, half when older, zero past the cut-off. */
function recencyWeight(days: number): number {
  if (days <= RECENCY.fullWeightDays) return 1;
  if (days <= RECENCY.halfWeightDays) return 0.5;
  return 0;
}

/** How strongly one piece of evidence shows that this center runs the campaign. */
export type CampaignProof = "job_ad" | "own_site" | "mention";

const PROOF_POINTS: Record<CampaignProof, number> = {
  job_ad: SIGNAL_POINTS.campaignFromJobAd,
  own_site: SIGNAL_POINTS.campaignFromOwnSite,
  mention: SIGNAL_POINTS.campaignMention,
};

const PROOF_LABELS: Record<CampaignProof, string> = {
  job_ad: "A job ad names them for this campaign",
  own_site: "Their own website offers this campaign",
  mention: "Campaign only mentioned (job-listing page, article, social post or gig)",
};

const sameText = (a: string, b: string) => {
  const [x, y] = [normalizeForMatch(a).replace(/[|·•\s]+$/, ""), normalizeForMatch(b).replace(/[|·•\s]+$/, "")];
  return x.length > 0 && (x.startsWith(y) || y.startsWith(x));
};

/**
 * Grades one piece of campaign evidence; null means it doesn't count at all.
 * - A job-listing page's title ("25+ Final Expense Closer Jobs") proves the campaign
 *   for the page, not for each employer listed on it, unless the employer's own
 *   excerpt on that page names the campaign too.
 * - On a website, a "Top 20 call centers" post is about other companies, and a
 *   blog post is weaker than a service page.
 */
export function campaignProof(e: ScoredEvidence, all: ScoredEvidence[], campaign: CampaignId): CampaignProof | null {
  if (campaignQuoteVerdict(campaign, e.quote, e.kind === "hiring") !== "ok") return null;
  if (e.kind === "hiring") {
    if (!isListingPageUrl(e.sourceUrl)) return "job_ad";
    const samePage = all.filter((x) => x.sourceUrl === e.sourceUrl && x.id !== e.id);
    const isPageTitle = samePage.some((x) => x.kind === "listing" && sameText(x.quote, e.quote));
    const ownExcerptNamesIt = samePage.some((x) => x.kind === "entity" && !!matchCampaign(campaign, x.quote));
    return isPageTitle && !ownExcerptNamesIt ? "mention" : "job_ad";
  }
  if (e.source === "website") {
    const page = websitePageKind(e.sourceUrl);
    return page === "listicle" ? null : page === "article" ? "mention" : "own_site";
  }
  return "mention";
}

/**
 * Explainable fit score. Pure: the same evidence and options always give the
 * same result, so the UI can re-score instantly when filters change.
 * Score = earned points ÷ applicable points × 100 (bonuses can push it to the cap).
 */
export function scoreCenter(center: ScoredCenter, allEvidence: ScoredEvidence[], options: ScoreOptions): ScoreResult {
  const evidence = allEvidence.filter(
    (e) => options.maxEvidenceAgeDays === null || ageDays(e, options.now) <= options.maxEvidenceAgeDays,
  );
  const lines: ScoreLine[] = [];
  let applicable = 0;

  /** Adds a signal line; `core` signals count toward the maximum, bonuses don't. */
  const add = (signal: string, label: string, max: number, supporting: ScoredEvidence[], core = true) => {
    const weight = supporting.length ? Math.max(...supporting.map((e) => recencyWeight(ageDays(e, options.now)))) : 0;
    if (core) applicable += max;
    lines.push({ signal, label, points: Math.round(max * weight), max, evidenceIds: supporting.map((e) => e.id), ...(core ? {} : { bonus: true }) });
  };

  // Campaign proof: only the strongest piece counts (a job ad OR the website, not both required).
  const graded = evidence
    .filter((e) => (e.kind === "hiring" || e.kind === "campaign") && e.value === options.campaign)
    .map((e) => ({ e, proof: campaignProof(e, evidence, options.campaign) }))
    .filter((g): g is { e: ScoredEvidence; proof: CampaignProof } => g.proof !== null);
  const campaignEvidence = graded.map((g) => g.e);
  const best = graded
    .map((g) => ({ ...g, points: Math.round(PROOF_POINTS[g.proof] * recencyWeight(ageDays(g.e, options.now))) }))
    .sort((a, b) => b.points - a.points || PROOF_POINTS[b.proof] - PROOF_POINTS[a.proof])[0];
  applicable += SIGNAL_POINTS.campaignFromJobAd;
  lines.push({
    signal: "campaignProof",
    label: best ? PROOF_LABELS[best.proof] : "No proof of this campaign",
    points: best?.points ?? 0,
    max: SIGNAL_POINTS.campaignFromJobAd,
    evidenceIds: best ? graded.filter((g) => g.proof === best.proof).map((g) => g.e.id) : [],
  });

  const proofSources = new Set(campaignEvidence.map((e) => e.source));
  add("corroborated", "Campaign shown by two kinds of source", SIGNAL_POINTS.corroborated, proofSources.size >= 2 ? campaignEvidence : [], false);

  // Reposted ads share their wording: cluster by normalized quote, only recent ones.
  const recentClusters = new Map<string, ScoredEvidence>();
  for (const { e, proof } of graded) {
    if (proof === "job_ad" && ageDays(e, options.now) <= RECENCY.fullWeightDays) recentClusters.set(normalizeForMatch(e.quote).slice(0, 80), e);
  }
  add("severalJobAds", "Several distinct job ads", SIGNAL_POINTS.severalJobAds, recentClusters.size >= 2 ? [...recentClusters.values()] : [], false);

  if (options.country !== "any") {
    // Location doesn't go stale like a job ad, so it isn't recency-weighted.
    const inCountry = center.country === options.country;
    const kinds = new Set(center.countrySignals.filter((s) => s.country === options.country).map((s) => labelFor(SIGNAL_TYPE_LABELS, s.type)));
    const confirmed = inCountry && kinds.size >= 2;
    applicable += SIGNAL_POINTS.countryConfirmed;
    lines.push({
      signal: confirmed ? "countryConfirmed" : "countryLikely",
      label: confirmed
        ? `In the requested country (${[...kinds].join(", ")})`
        : inCountry
          ? `Probably in the requested country (${[...kinds].join(", ")} only)`
          : "Not shown to be in the requested country",
      points: confirmed ? SIGNAL_POINTS.countryConfirmed : inCountry ? SIGNAL_POINTS.countryLikely : 0,
      max: SIGNAL_POINTS.countryConfirmed,
      evidenceIds: evidence.filter((e) => e.kind === "country").map((e) => e.id),
    });
  }

  if (options.market === "spanish" || options.market === "bilingual") {
    const market = options.market;
    const supporting = evidence.filter((e) => e.kind === "market" && marketMatches(market, e.value as MarketId));
    add("servesMarket", `Serves the ${market === "spanish" ? "Spanish" : "bilingual"} market`, SIGNAL_POINTS.servesMarket, supporting);
  }

  const revenueRoles = new Set(["sales", "live_transfer", "appointment_setting"]);
  add(
    "revenueRole",
    "Sales, live transfers or appointment setting",
    SIGNAL_POINTS.revenueRole,
    campaignEvidence.filter((e) => e.campaignRole && revenueRoles.has(e.campaignRole)),
  );

  const sourceTypes = new Set(evidence.map((e) => e.source));
  const firstPerSource = [...sourceTypes].map((s) => evidence.find((e) => e.source === s)!);
  add("independentSources", "Found in 2+ kinds of source", SIGNAL_POINTS.independentSources, sourceTypes.size >= 2 ? firstPerSource : []);

  const hasContact = center.phones.length > 0 || center.emails.length > 0 || !!center.domain;
  applicable += SIGNAL_POINTS.hasContact;
  lines.push({
    signal: "hasContact",
    label: "Has a business phone, email or website",
    points: hasContact ? SIGNAL_POINTS.hasContact : 0,
    max: SIGNAL_POINTS.hasContact,
    evidenceIds: [],
  });

  add("complianceLanguage", "Compliance language (TCPA, DNC, consent, recordings)", SIGNAL_POINTS.complianceLanguage, evidence.filter((e) => e.kind === "compliance"));
  add("usHours", "Works US hours / night shift", SIGNAL_POINTS.usHours, evidence.filter((e) => e.kind === "us_hours"), false);

  // Penalties.
  if (evidence.length > 0 && evidence.every((e) => e.source === "vendor_marketplace")) {
    lines.push({ signal: "vendorListingOnly", label: "Only evidence is a freelance gig (self-claimed)", points: PENALTY_POINTS.vendorListingOnly, max: 0, evidenceIds: evidence.map((e) => e.id) });
  }
  // Re-checked here so flags saved before the negation rule ("never resold") don't count.
  const redFlags = evidence.filter((e) => e.kind === "red_flag" && redFlagQuoteVerdict(e.value, e.quote) === "ok");
  for (const flag of redFlags) {
    const resold = flag.value === "resold_transfers";
    lines.push({
      signal: resold ? "resoldTransfers" : "redFlag",
      label: resold ? "Advertises shared / resold transfers" : `Red flag: ${flag.value.replace(/_/g, " ")}`,
      points: resold ? PENALTY_POINTS.resoldTransfers : PENALTY_POINTS.redFlag,
      max: 0,
      evidenceIds: [flag.id],
    });
  }

  const earned = lines.reduce((sum, l) => sum + l.points, 0);
  const score = Math.max(0, Math.min(100, Math.round((earned / Math.max(applicable, 1)) * 100)));
  const directProof = best?.proof === "job_ad" || best?.proof === "own_site";
  // A search for one country is only a fit if the center is shown to be there.
  const locationUnknown = options.country !== "any" && center.country !== options.country;
  const label: ConfidenceLabel = locationUnknown
    ? "low"
    : score >= CONFIDENCE_THRESHOLDS.high.minScore && directProof
      ? "high"
      : score >= CONFIDENCE_THRESHOLDS.medium.minScore
        ? "medium"
        : "low";
  const labelReason = locationUnknown
    ? "Low: not shown to be in the requested country"
    : score >= CONFIDENCE_THRESHOLDS.high.minScore && !directProof
      ? "Not High: no job ad or own website names them for this campaign"
      : null;

  return { score, label, lines, independentSourceTypes: sourceTypes.size, redFlags: redFlags.map((f) => f.value), labelReason, earned, possible: applicable };
}

/** Proof from a job ad or the company's own website, not just a mention elsewhere ("Campaign confirmed"). */
export function hasDirectCampaignProof(evidence: ScoredEvidence[], campaign: CampaignId): boolean {
  return evidence.some((e) => (e.kind === "hiring" || e.kind === "campaign") && e.value === campaign && isDirectProof(campaignProof(e, evidence, campaign)));
}

const isDirectProof = (proof: CampaignProof | null) => proof === "job_ad" || proof === "own_site";

/** Whether any evidence counts as proof of the campaign (else the center isn't a result). */
export function hasCampaignEvidence(evidence: ScoredEvidence[], campaign: CampaignId): boolean {
  return evidence.some((e) => (e.kind === "hiring" || e.kind === "campaign") && e.value === campaign && campaignProof(e, evidence, campaign) !== null);
}
