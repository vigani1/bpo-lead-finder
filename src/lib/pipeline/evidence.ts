import "server-only";
import type { Db } from "@/lib/db/client";
import { evidence, type EvidenceKind, type NewEvidence } from "@/lib/db/schema";
import type { MergeRule } from "@/lib/resolve/resolve-center";
import { countryIdFromName } from "./country";
import type { Doc } from "./types";
import type { VerificationResult } from "./verify-claims";

const HIRING_POST = /\b(we'?re hiring|we are hiring|is hiring|now hiring|join (our|us)|looking for|vacanc|apply now|estamos contratando|vacante)/i;

/** Job ads, and social posts that are hiring posts ("We're hiring FE verifiers"), prove an active campaign. */
export function evidenceKindFor(doc: Doc, claimKind: string): EvidenceKind {
  if (claimKind !== "campaign") return claimKind as EvidenceKind;
  return doc.kind === "job_ad" || (doc.kind === "social" && HIRING_POST.test(doc.text)) ? "hiring" : "campaign";
}

/** Turns verified claims about one document into evidence rows (plus a "listed on" row for link-only sources). */
export function buildEvidenceRows(input: {
  doc: Doc;
  verification: VerificationResult;
  centerId: string;
  searchId: string | null;
  rule: MergeRule;
  classifierId: string;
}): NewEvidence[] {
  const { doc, verification, centerId, searchId, rule, classifierId } = input;
  const base = { centerId, searchId, source: doc.evidenceSource, mergeRule: rule, classifier: classifierId, postedAt: doc.publishedAt };
  const rows: NewEvidence[] = verification.claims.map((claim) => ({
    ...base,
    kind: evidenceKindFor(doc, claim.kind),
    value: claim.kind === "country" ? (countryIdFromName(claim.value) ?? claim.value) : claim.value,
    campaignRole: claim.role ?? null,
    quote: claim.quote,
    matchType: claim.matchType,
    sourceUrl: claim.url,
  }));
  if (doc.kind !== "website") {
    rows.push({ ...base, kind: "listing", value: doc.kind, campaignRole: null, quote: doc.title, matchType: "exact", sourceUrl: doc.url });
  }
  return rows;
}

/** Inserts evidence; evidence already known just gets a fresh "seen" date. */
export async function saveEvidence(db: Db, rows: NewEvidence[], searchId: string | null): Promise<void> {
  // The model can return the same fact twice; one insert can't touch the same row twice, so drop repeats first.
  const unique = [...new Map(rows.map((r) => [[r.centerId, r.kind, r.value, r.sourceUrl, r.quote].join("\u0000"), r])).values()];
  if (unique.length === 0) return;
  await db
    .insert(evidence)
    .values(unique)
    .onConflictDoUpdate({
      target: [evidence.centerId, evidence.kind, evidence.value, evidence.sourceUrl, evidence.quote],
      set: searchId ? { seenAt: new Date(), searchId } : { seenAt: new Date() },
    });
}
