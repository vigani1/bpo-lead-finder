import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { centers, type Center, type CountrySignal, type SocialLink } from "@/lib/db/schema";
import { inferCountry, mergeSignals } from "@/lib/pipeline/country";
import { foldAccents, unique } from "@/lib/text";
import { nameMatchThreshold } from "./normalize-name";

export interface Observation {
  name: string;
  normalizedName: string;
  entityType: string;
  domain: string | null;
  websiteUrl: string | null;
  websiteStatus: Center["websiteStatus"];
  phones: string[];
  emails: string[];
  city: string | null;
  countrySignals: CountrySignal[];
  socialLinks: SocialLink[];
  summary: string | null;
}

export type MergeRule = "new" | "domain" | "phone" | "name_city";

/** Names this similar (after removing legal forms) are treated as the same name. */
const NEAR_IDENTICAL = 0.95;

const WEBSITE_STATUS_RANK: Record<Center["websiteStatus"], number> = { ok: 4, js_only: 3, blocked: 2, dead: 1, none: 0 };

/** True when two normalized names count as the same company, by the same measure merging uses. */
export async function namesMatch(db: Db, a: string, b: string): Promise<boolean> {
  if (!a || !b) return false;
  const [row] = await db.execute<{ score: number }>(sql`select similarity(${a}, ${b}) as score`).then((r) => r.rows);
  const shorter = a.length < b.length ? a : b;
  return (row?.score ?? 0) >= nameMatchThreshold(shorter);
}

async function findExisting(db: Db, obs: Observation): Promise<{ center: Center; rule: MergeRule } | null> {
  // 1. Same registered domain.
  if (obs.domain) {
    const [byDomain] = await db.select().from(centers).where(eq(centers.domain, obs.domain)).limit(1);
    if (byDomain) return { center: byDomain, rule: "domain" };
  }

  // 2. Same phone, unless the number is shared by several centers (directory or tracking line).
  if (obs.phones.length) {
    const byPhone = await db
      .select()
      .from(centers)
      .where(sql`${centers.phones} && ARRAY[${sql.join(obs.phones.map((p) => sql`${p}`), sql`, `)}]::text[]`)
      .limit(2);
    if (byPhone.length === 1) return { center: byPhone[0]!, rule: "phone" };
  }

  // 3. Similar name, and nothing that contradicts it. Missing details don't block a merge;
  //    conflicting ones do: "Prime BPO" in Lahore ≠ "Prime BPO" in Rawalpindi.
  //    A merely similar name also needs the same city or country; a near-identical one doesn't.
  if (obs.normalizedName.length >= 3) {
    const similar = await db
      .select({ center: centers, similarity: sql<number>`similarity(${centers.normalizedName}, ${obs.normalizedName})` })
      .from(centers)
      .where(sql`${centers.normalizedName} % ${obs.normalizedName}`)
      .orderBy(sql`similarity(${centers.normalizedName}, ${obs.normalizedName}) desc`)
      .limit(5);
    const obsCountry = inferCountry(obs.countrySignals).country;
    const match = similar.find(({ center, similarity }) => {
      // The shorter name decides how strict to be: "Prime" vs "Prime III" must not merge on name alone.
      const shorter = center.normalizedName.length < obs.normalizedName.length ? center.normalizedName : obs.normalizedName;
      if (similarity < nameMatchThreshold(shorter)) return false;
      const cityConflict = !!obs.city && !!center.city && foldAccents(obs.city) !== foldAccents(center.city);
      const countryConflict = !!obsCountry && !!center.country && obsCountry !== center.country;
      if (cityConflict || countryConflict) return false;
      const sameCity = !!obs.city && !!center.city;
      const sameCountry = !!obsCountry && obsCountry === center.country;
      return sameCity || sameCountry || similarity >= NEAR_IDENTICAL;
    });
    if (match) return { center: match.center, rule: "name_city" };
  }
  return null;
}

/**
 * Finds the center an observation belongs to (domain → phone → name + city)
 * or creates a new one. Merging only adds information; it never overwrites
 * a known value with an unknown one. Runs sequentially to avoid duplicate inserts.
 */
export async function resolveCenter(db: Db, obs: Observation): Promise<{ centerId: string; rule: MergeRule }> {
  const existing = await findExisting(db, obs);

  if (!existing) {
    const country = inferCountry(obs.countrySignals);
    const [created] = await db
      .insert(centers)
      .values({
        name: obs.name,
        normalizedName: obs.normalizedName,
        entityType: obs.entityType,
        domain: obs.domain,
        websiteUrl: obs.websiteUrl,
        websiteStatus: obs.websiteStatus,
        phones: obs.phones,
        emails: obs.emails,
        country: country.country,
        countrySignals: obs.countrySignals,
        city: obs.city,
        socialLinks: obs.socialLinks,
        summary: obs.summary,
      })
      .returning({ id: centers.id });
    return { centerId: created!.id, rule: "new" };
  }

  const { center, rule } = existing;
  const countrySignals = mergeSignals(center.countrySignals, obs.countrySignals);
  const socialLinks = [...center.socialLinks];
  for (const link of obs.socialLinks) if (!socialLinks.some((s) => s.url === link.url)) socialLinks.push(link);
  const betterSite = WEBSITE_STATUS_RANK[obs.websiteStatus] > WEBSITE_STATUS_RANK[center.websiteStatus];

  await db
    .update(centers)
    .set({
      domain: center.domain ?? obs.domain,
      websiteUrl: center.websiteUrl ?? obs.websiteUrl,
      websiteStatus: betterSite ? obs.websiteStatus : center.websiteStatus,
      // A name from the company's own website beats one parsed from a job-ad title.
      name: obs.domain && !center.domain ? obs.name : center.name,
      normalizedName: obs.domain && !center.domain ? obs.normalizedName : center.normalizedName,
      entityType: center.entityType === "other" ? obs.entityType : center.entityType,
      phones: unique([...center.phones, ...obs.phones]),
      emails: unique([...center.emails, ...obs.emails]),
      city: center.city ?? obs.city,
      countrySignals,
      country: inferCountry(countrySignals).country,
      socialLinks,
      summary: center.summary ?? obs.summary,
      lastCheckedAt: new Date(),
    })
    .where(eq(centers.id, center.id));
  return { centerId: center.id, rule };
}
