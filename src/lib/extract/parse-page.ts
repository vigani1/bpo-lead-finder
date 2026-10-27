import "server-only";
import * as cheerio from "cheerio";
import type { CountryCode } from "libphonenumber-js/max";
import type { SocialLink } from "@/lib/db/schema";
import { socialPlatform } from "@/lib/page-kinds";
import { unique } from "@/lib/text";
import { extractEmails } from "./emails";
import { extractPhones } from "./phones";

export interface JsonLdOrganization {
  name?: string;
  description?: string;
  telephone?: string[];
  email?: string[];
  address?: string;
  sameAs?: string[];
}

export interface ExtractedPage {
  title: string;
  text: string;
  siteName?: string;
  description?: string;
  organization?: JsonLdOrganization;
  phones: string[];
  emails: string[];
  socialLinks: SocialLink[];
  /** Same-site links worth visiting (contact, about, services, careers). */
  interestingLinks: string[];
}

const INTERESTING_PATH = /(contact|about|service|campaign|careers|jobs|insurance|medicare|final-expense|aca|who-we-are|solutions)/i;


/** A social link on a company website; LinkedIn only for company pages (personal profiles are skipped). */
function socialLink(url: URL): string | undefined {
  const platform = socialPlatform(url.hostname);
  if (platform === "LinkedIn" && !url.pathname.startsWith("/company")) return undefined;
  return platform;
}

function toArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(toArray);
  if (typeof value === "string") return [value];
  return [];
}

function addressToString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const a = value as Record<string, unknown>;
    const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.addressCountry]
      .map((p) => (typeof p === "string" ? p : typeof p === "object" && p ? (p as { name?: string }).name : undefined))
      .filter(Boolean);
    return parts.length ? parts.join(", ") : undefined;
  }
  return undefined;
}

/** Reads schema.org Organization / LocalBusiness data, which many JS-only sites still ship in raw HTML. */
function readJsonLd($: cheerio.CheerioAPI): JsonLdOrganization | undefined {
  const nodes: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed: unknown = JSON.parse($(el).text());
      const queue = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of queue) {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          if (Array.isArray(record["@graph"])) queue.push(...(record["@graph"] as unknown[]));
          nodes.push(record);
        }
      }
    } catch {
      // Malformed JSON-LD is common; ignore it.
    }
  });

  const org = nodes.find((n) => {
    const types = toArray(n["@type"]);
    return types.some((t) => /Organization|LocalBusiness|Corporation|ProfessionalService/i.test(t));
  });
  if (!org) return undefined;

  const rawContactPoints = Array.isArray(org.contactPoint) ? org.contactPoint : org.contactPoint ? [org.contactPoint] : [];
  const contactPoints = rawContactPoints.filter((cp): cp is Record<string, unknown> => !!cp && typeof cp === "object");
  const cpPhones = contactPoints.flatMap((cp) => toArray(cp.telephone));
  const cpEmails = contactPoints.flatMap((cp) => toArray(cp.email));

  return {
    name: typeof org.name === "string" ? org.name : undefined,
    description: typeof org.description === "string" ? org.description : undefined,
    telephone: unique([...toArray(org.telephone), ...cpPhones]),
    email: unique([...toArray(org.email), ...cpEmails].map((e) => e.replace(/^mailto:/i, ""))),
    address: addressToString(org.address),
    sameAs: toArray(org.sameAs),
  };
}

/**
 * @param defaultCountry ISO2 used to read local-format numbers (e.g. "051-4571963" on a .pk site).
 */
export function extractPage(html: string, pageUrl: string, defaultCountry?: CountryCode): ExtractedPage {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const organization = readJsonLd($);

  const title = $("title").first().text().trim();
  const siteName = $('meta[property="og:site_name"]').attr("content")?.trim();
  const description =
    $('meta[name="description"]').attr("content")?.trim() ?? $('meta[property="og:description"]').attr("content")?.trim();

  const links: URL[] = [];
  const telLinks: string[] = [];
  const mailLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("tel:")) telLinks.push(decodeURIComponent(href.slice(4)));
    else if (href.startsWith("mailto:")) mailLinks.push(decodeURIComponent(href.slice(7).split("?")[0] ?? ""));
    else {
      try {
        links.push(new URL(href, base));
      } catch {
        // ignore unparsable links
      }
    }
  });

  $("script, style, noscript, svg, iframe, template").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  // Meta description and JSON-LD description count as page text: they are the site's own words.
  const text = [title, description, organization?.description, bodyText].filter(Boolean).join("\n");

  const socialLinks: SocialLink[] = [];
  for (const link of [...links, ...(organization?.sameAs ?? []).flatMap((s) => (URL.canParse(s) ? [new URL(s)] : []))]) {
    const platform = socialLink(link);
    if (platform && !socialLinks.some((s) => s.url === link.toString())) {
      socialLinks.push({ platform, url: `${link.origin}${link.pathname}` });
    }
  }

  const interestingLinks = unique(
    links
      .filter((l) => l.hostname === base.hostname && INTERESTING_PATH.test(l.pathname) && !/\.(pdf|jpg|png|zip)$/i.test(l.pathname))
      .map((l) => `${l.origin}${l.pathname}`),
  ).slice(0, 10);

  return {
    title,
    text,
    siteName,
    description,
    organization,
    phones: extractPhones([...telLinks, ...(organization?.telephone ?? []), text].join("\n"), defaultCountry),
    emails: extractEmails([...mailLinks, ...(organization?.email ?? []), text].join("\n"), { roleBasedOnly: true }),
    socialLinks,
    interestingLinks,
  };
}
