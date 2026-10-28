import "server-only";
import { eq } from "drizzle-orm";
import type { CountryCode } from "libphonenumber-js/max";
import { countryFromTld, getCountry } from "@/lib/all-countries";
import { LIMITS } from "@/config/limits";
import type { Db } from "@/lib/db/client";
import { pageCache, type SocialLink } from "@/lib/db/schema";
import { extractEmails } from "@/lib/extract/emails";
import { extractPage, type ExtractedPage } from "@/lib/extract/parse-page";
import { extractPhones } from "@/lib/extract/phones";
import { allowsAiInput, isAllowedByRobots } from "@/lib/http/robots";
import { FetchBlockedError, safeFetch } from "@/lib/http/safe-fetch";
import { sha256, unique } from "@/lib/text";
import type { SiteCandidate } from "./triage";
import type { Doc } from "./types";

type PageStatus = "ok" | "js_only" | "blocked" | "robots" | "error";

interface PageResult {
  url: string;
  status: PageStatus;
  page?: ExtractedPage;
}

const PARKED = /(domain (is )?for sale|buy this domain|this domain may be for sale|parked (free|domain)|\/lander\b)/i;

function defaultCountryForDomain(domain: string): CountryCode | undefined {
  const tld = domain.split(".").at(-1);
  const id = countryFromTld(tld);
  return id ? (getCountry(id)?.iso2 as CountryCode | undefined) : undefined;
}

/** One page: from the cache (7 days, failures 6 hours), else robots check + safe fetch + extraction. */
async function getPage(db: Db, url: string, defaultCountry?: CountryCode, skipCache = false): Promise<PageResult> {
  const [cached] = skipCache ? [] : await db.select().from(pageCache).where(eq(pageCache.url, url)).limit(1);
  const maxAgeMs = cached?.status === "ok" || cached?.status === "js_only" ? LIMITS.fetch.pageCacheDays * 86_400_000 : LIMITS.fetch.failedPageCacheHours * 3_600_000;
  const fresh = cached && Date.now() - cached.fetchedAt.getTime() < maxAgeMs;
  if (cached && fresh) {
    return { url, status: cached.status, page: (cached.extracted as ExtractedPage | null) ?? undefined };
  }

  let result: PageResult;
  if (!(await isAllowedByRobots(url))) {
    result = { url, status: "robots" };
  } else {
    try {
      // Every redirect hop is checked against robots.txt too, not just the first address.
      const response = await safeFetch(url, { canFollow: isAllowedByRobots });
      const page = extractPage(response.body, response.url, defaultCountry);
      const visible = page.text.length - page.title.length;
      result = { url, status: PARKED.test(response.url) || PARKED.test(page.text) ? "error" : visible < LIMITS.fetch.minTextChars ? "js_only" : "ok", page };
    } catch (error) {
      const refused = error instanceof FetchBlockedError && error.reason === "robots";
      const blocked = error instanceof FetchBlockedError && (error.status === 401 || error.status === 403 || error.status === 429);
      result = { url, status: refused ? "robots" : blocked ? "blocked" : "error" };
    }
  }

  await db
    .insert(pageCache)
    .values({
      url,
      status: result.status,
      title: result.page?.title ?? null,
      text: result.page?.text ?? null,
      contentHash: result.page ? sha256(result.page.text) : null,
      extracted: result.page ?? null,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pageCache.url,
      set: {
        status: result.status,
        title: result.page?.title ?? null,
        text: result.page?.text ?? null,
        contentHash: result.page ? sha256(result.page.text) : null,
        extracted: result.page ?? null,
        fetchedAt: new Date(),
      },
    });
  return result;
}

export interface FetchedSite {
  doc: Doc | null;
  websiteStatus: "ok" | "js_only" | "blocked" | "dead";
  homepage: string;
  pagesFetched: number;
  /** Paid units used by the rendering fallback. */
  renderCredits: number;
}

export interface FetchSiteOptions {
  pagesPerSite: number;
  /** Renders a JavaScript-only page (e.g. Tavily Extract). Optional. */
  render?: (url: string) => Promise<{ text: string; credits: number } | null>;
  /** Ignore the page cache (used by "Re-check now"). */
  fresh?: boolean;
}

/**
 * Politely reads a company's own site: the page the search found, the
 * homepage, and a few contact/about/services pages. JavaScript-only pages
 * still yield their title, meta description and JSON-LD.
 */
export async function fetchSite(db: Db, candidate: Pick<SiteCandidate, "url" | "registeredDomain">, options: FetchSiteOptions): Promise<FetchedSite> {
  const { pagesPerSite } = options;
  const origin = new URL(candidate.url).origin;
  const homepage = `${origin}/`;
  const defaultCountry = defaultCountryForDomain(candidate.registeredDomain);

  const queue = unique([candidate.url, homepage]);
  const queued = new Set(queue);
  const results: PageResult[] = [];
  // One page at a time on purpose: polite to small sites, and later links come from earlier pages.
  while (queue.length > 0 && results.length < pagesPerSite) {
    const result = await getPage(db, queue.shift()!, defaultCountry, options.fresh);
    results.push(result);
    for (const link of result.page?.interestingLinks ?? []) {
      if (!queued.has(link)) {
        queued.add(link);
        queue.push(link);
      }
    }
  }

  const readable = results.filter((r) => (r.status === "ok" || r.status === "js_only") && r.page && r.page.text.trim());

  // JavaScript-only site: robots.txt already allowed it, so render the homepage through the fallback.
  let renderCredits = 0;
  if (options.render && readable.length > 0 && !readable.some((r) => r.status === "ok")) {
    const rendered = await options.render(homepage);
    if (rendered && rendered.text.length >= LIMITS.fetch.minTextChars) {
      renderCredits = rendered.credits;
      const base = readable.find((r) => r.url === homepage) ?? readable[0]!;
      base.status = "ok";
      base.page = {
        ...base.page!,
        text: `${base.page!.text}\n${rendered.text}`,
        phones: unique([...base.page!.phones, ...extractPhones(rendered.text, defaultCountry)]),
        emails: unique([...base.page!.emails, ...extractEmails(rendered.text, { roleBasedOnly: true })]),
      };
    }
  }

  const websiteStatus: FetchedSite["websiteStatus"] = readable.some((r) => r.status === "ok")
    ? "ok"
    : readable.length
      ? "js_only"
      : results.some((r) => r.status === "blocked" || r.status === "robots")
        ? "blocked"
        : "dead";

  if (readable.length === 0) return { doc: null, websiteStatus, homepage, pagesFetched: results.length, renderCredits };

  const pages = readable.map((r) => ({ url: r.url, text: r.page!.text }));
  const text = pages.map((p) => `[Page: ${p.url}]\n${p.text}`).join("\n\n");
  const all = readable.map((r) => r.page!);
  const org = all.find((p) => p.organization)?.organization;
  const socialLinks: SocialLink[] = [];
  for (const link of all.flatMap((p) => p.socialLinks)) {
    if (!socialLinks.some((s) => s.url === link.url)) socialLinks.push(link);
  }
  const home = readable.find((r) => r.url === homepage)?.page ?? all[0]!;
  // Every site the text came from must allow AI input, including sites a page redirected to.
  const origins = unique([homepage, ...readable.map((r) => r.page!.url ?? r.url)].map((u) => new URL(u).origin));
  const aiInputAllowed = (await Promise.all(origins.map(allowsAiInput))).every(Boolean);

  return {
    websiteStatus,
    homepage,
    pagesFetched: results.length,
    renderCredits,
    doc: {
      url: candidate.url,
      registeredDomain: candidate.registeredDomain,
      kind: "website",
      evidenceSource: "website",
      title: home.title,
      text,
      contentHash: sha256(text),
      publishedAt: null,
      siteUrl: homepage,
      pages,
      aiInputAllowed,
      facts: {
        siteName: home.siteName,
        jsonLdName: org?.name,
        address: org?.address,
        phones: unique(all.flatMap((p) => p.phones)),
        emails: unique(all.flatMap((p) => p.emails)),
        socialLinks,
      },
    },
  };
}
