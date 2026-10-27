import "server-only";
import { eq } from "drizzle-orm";
import { BLOCKED_COMPANY_NAMES } from "@/config/blocked-domains";
import { countryInSentence } from "@/config/countries";
import { HIDDEN_EMPLOYER_PATTERNS } from "@/config/signals";
import { isPlaceholderName } from "@/lib/ai/rules/company-name";
import { CENTER_ENTITY_TYPES, ENTITY_LABELS, type Classification, type EntityType } from "@/lib/ai/schema";
import { centers } from "@/lib/db/schema";
import { socialPlatform } from "@/lib/page-kinds";
import { normalizeCompanyName } from "@/lib/resolve/normalize-name";
import { resolveCenter, type Observation } from "@/lib/resolve/resolve-center";
import { collectCountrySignals } from "../country";
import { buildEvidenceRows, saveEvidence } from "../evidence";
import type { FetchedSite } from "../fetch-site";
import type { Doc } from "../types";
import { verifyClaims, type VerificationResult } from "../verify-claims";
import { addRuledOut, type RunContext } from "./context";
import { upsertResult } from "./results";

/** "Confidential", "Hiring company" and the like: the employer is hidden, so there's nothing to resolve. */
function isHiddenEmployer(name: string): boolean {
  return HIDDEN_EMPLOYER_PATTERNS.some((p) => p.test(name.trim())) || BLOCKED_COMPANY_NAMES.some((b) => b.toLowerCase() === name.toLowerCase());
}

/** What this document says about the company, in the shape entity resolution compares. */
function toObservation(doc: Doc, classification: Classification, verification: VerificationResult, name: string, site?: FetchedSite): Observation {
  const phones = doc.facts?.phones ?? [];
  const socialLinks = [...(doc.facts?.socialLinks ?? [])];
  if (doc.kind === "social") socialLinks.push({ platform: socialPlatform(new URL(doc.url).hostname) ?? "Social", url: doc.url });

  return {
    name,
    normalizedName: normalizeCompanyName(name),
    entityType: classification.entityType as EntityType,
    domain: doc.kind === "website" ? doc.registeredDomain : null,
    websiteUrl: doc.kind === "website" ? (doc.siteUrl ?? doc.url) : null,
    websiteStatus: site?.websiteStatus ?? "none",
    phones,
    emails: doc.facts?.emails ?? [],
    city: classification.city,
    countrySignals: collectCountrySignals({
      phones,
      registeredDomain: doc.kind === "website" ? doc.registeredDomain : null,
      boardCountry: doc.boardCountry,
      city: classification.city,
      aiCountries: verification.claims.filter((c) => c.kind === "country").map((c) => c.value),
    }),
    socialLinks,
    summary: classification.summary,
  };
}

/** Saves what one classified document says: rule it out, or attach it to a center. */
export async function persistDoc(ctx: RunContext, doc: Doc, classification: Classification, classifierId: string, site?: FetchedSite) {
  const verification = verifyClaims(doc, classification);
  ctx.progress.counts.claimsDropped += verification.dropped.length;
  const name = classification.companyName?.trim() ?? "";
  const entityType = classification.entityType as EntityType;

  if (!CENTER_ENTITY_TYPES.includes(entityType)) {
    await addRuledOut(ctx, [{ url: doc.url, name: name || doc.title, reason: "not_a_center", detail: ENTITY_LABELS[entityType] }]);
    return;
  }
  if (!name || isHiddenEmployer(name) || isPlaceholderName(name)) {
    await addRuledOut(ctx, [{ url: doc.url, name: doc.title, reason: "employer_not_named" }]);
    return;
  }
  const campaignClaims = verification.claims.filter((c) => c.kind === "campaign");
  if (campaignClaims.length === 0) {
    await addRuledOut(ctx, [{ url: doc.url, name, reason: "campaign_not_evidenced", detail: "No verified insurance campaign" }]);
    return;
  }

  const observation = toObservation(doc, classification, verification, name, site);
  const task = ctx.writeQueue.then(async () => {
    const { centerId, rule } = await resolveCenter(ctx.db, observation);
    await saveEvidence(ctx.db, buildEvidenceRows({ doc, verification, centerId, searchId: ctx.search.id, rule, classifierId }), ctx.search.id);
    const [center] = await ctx.db.select({ country: centers.country, domain: centers.domain }).from(centers).where(eq(centers.id, centerId));

    // Evidence is kept either way; the center just isn't a result for this search.
    if (!(await upsertResult(ctx, centerId, false))) {
      const campaigns = [...new Set(campaignClaims.map((c) => c.value))].join(", ");
      const elsewhere = ctx.filters.country !== "any" && center?.country && center.country !== ctx.filters.country;
      await addRuledOut(ctx, [
        elsewhere
          ? { url: doc.url, name, reason: "wrong_country", detail: `Located in ${countryInSentence(center?.country)}` }
          : { url: doc.url, name, reason: "campaign_not_evidenced", detail: `Evidence for ${campaigns}, not ${ctx.filters.campaign}` },
      ]);
    }
    if (doc.kind === "job_ad" && !center?.domain && !ctx.employersWithoutSite.some((e) => e.centerId === centerId)) {
      ctx.employersWithoutSite.push({ name, city: classification.city, centerId });
    }
  });
  // The queue only orders writes: a failed write fails this document (the caller reports it), not every later one.
  ctx.writeQueue = task.catch(() => undefined);
  await task;
}
