import "server-only";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { CAMPAIGN_IDS, type CampaignId } from "@/config/campaigns";
import { classifyCached } from "@/lib/ai";
import { AppError, notFound } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { centers, evidence } from "@/lib/db/schema";
import { normalizeCompanyName } from "@/lib/resolve/normalize-name";
import { namesMatch } from "@/lib/resolve/resolve-center";
import { getPageRenderer, getStorableSearchSource } from "@/lib/sources";
import { unique } from "@/lib/text";
import { employerLookupQuery } from "./build-queries";
import { buildEvidenceRows, saveEvidence } from "./evidence";
import { fetchSite } from "./fetch-site";
import { triage } from "./triage";
import type { Doc, SearchFilters } from "./types";
import { verifyClaims } from "./verify-claims";

const MIN_MINUTES_BETWEEN_CHECKS = 10;

export interface RecheckResult {
  newEvidence: number;
  websiteStatus: string;
  checked: "website" | "search";
}

/**
 * "Re-check now": refreshes one center's evidence without a whole new search.
 * With a website: fetch it again (no cache) and re-read it. Without one: one
 * search for the center's name, keeping only results about this same center.
 */
export async function recheckCenter(centerId: string): Promise<RecheckResult> {
  const db = await getDb();
  const [center] = await db.select().from(centers).where(eq(centers.id, centerId)).limit(1);
  if (!center) throw notFound("Center");

  // Claim the slot first, in one statement, so double clicks and failed runs still wait the full
  // interval. Only manual re-checks count: a search that just read this center doesn't block one.
  const claimed = await db
    .update(centers)
    .set({ recheckedAt: sql`now()`, lastCheckedAt: sql`now()` })
    .where(
      and(
        eq(centers.id, centerId),
        or(isNull(centers.recheckedAt), lt(centers.recheckedAt, sql`now() - ${MIN_MINUTES_BETWEEN_CHECKS} * interval '1 minute'`)),
      ),
    )
    .returning({ id: centers.id });
  if (claimed.length === 0) {
    const minutesSince = center.recheckedAt ? (Date.now() - center.recheckedAt.getTime()) / 60_000 : 0;
    throw new AppError("RATE_LIMITED", `This center was re-checked ${Math.max(1, Math.round(minutesSince))} min ago. Try again in a few minutes.`, {
      retryAfterSeconds: Math.max(60, Math.ceil((MIN_MINUTES_BETWEEN_CHECKS - minutesSince) * 60)),
    });
  }

  const before = (await db.select({ id: evidence.id }).from(evidence).where(eq(evidence.centerId, centerId))).length;
  // The campaign this center was most recently found for.
  const [latest] = await db
    .select({ value: evidence.value })
    .from(evidence)
    .where(and(eq(evidence.centerId, centerId), inArray(evidence.kind, ["hiring", "campaign"])))
    .orderBy(desc(evidence.seenAt))
    .limit(1);
  const campaign = CAMPAIGN_IDS.find((id) => id === latest?.value) ?? ("final_expense" satisfies CampaignId);
  const filters: SearchFilters = {
    country: (center.country as SearchFilters["country"]) ?? "any",
    market: "any",
    campaign,
    depth: "quick",
  };

  const docs: Doc[] = [];
  let websiteStatus: string = center.websiteStatus;
  let checked: RecheckResult["checked"] = "search";

  if (center.websiteUrl && center.domain) {
    checked = "website";
    const site = await fetchSite(
      db,
      { url: center.websiteUrl, registeredDomain: center.domain, storableTitle: center.name, fromStorableSource: true },
      { pagesPerSite: 4, render: getPageRenderer(), fresh: true },
    );
    websiteStatus = site.websiteStatus;
    if (site.doc) docs.push(site.doc);
    await db
      .update(centers)
      .set({
        websiteStatus: site.websiteStatus,
        phones: unique([...center.phones, ...(site.doc?.facts?.phones ?? [])]),
        emails: unique([...center.emails, ...(site.doc?.facts?.emails ?? [])]),
      })
      .where(eq(centers.id, centerId));
  } else {
    const source = getStorableSearchSource();
    const { hits } = await source.search(employerLookupQuery(center.name, center.city, filters), filters);
    const triaged = triage(hits.map((h) => ({ ...h, sourceId: source.id, storable: true })), filters);
    docs.push(...triaged.snippetDocs);
  }

  const target = center.normalizedName;
  for (const doc of docs) {
    // One at a time on purpose: the free AI tier allows only so many tokens per minute.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    const { classification, classifierId } = await classifyCached(db, doc);
    // Only keep results about this same center (a name search also finds namesakes).
    if (doc.kind !== "website") {
      const name = normalizeCompanyName(classification.companyName ?? "");
      if (!(await namesMatch(db, name, target))) continue;
    }
    const verification = verifyClaims(doc, classification);
    const rows = buildEvidenceRows({ doc, verification, centerId, searchId: null, rule: doc.kind === "website" ? "domain" : "name_city", classifierId });
    await saveEvidence(db, rows, null);
  }

  const after = (await db.select({ id: evidence.id }).from(evidence).where(eq(evidence.centerId, centerId))).length;
  return { newEvidence: after - before, websiteStatus, checked };
}
