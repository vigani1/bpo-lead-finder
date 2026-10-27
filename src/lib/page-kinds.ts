import { SOCIAL_PLATFORMS } from "@/config/domains";

/**
 * What kind of page a URL points to, from its address alone: a social
 * platform, a person's profile, a job board page listing many employers,
 * a "top 20" listicle, a blog article.
 */

/** "Facebook" for facebook.com and its subdomains; undefined for other sites. */
export function socialPlatform(hostname: string): string | undefined {
  const host = hostname.replace(/^www\./, "");
  const domain = Object.keys(SOCIAL_PLATFORMS).find((d) => host === d || host.endsWith(`.${d}`));
  return domain ? SOCIAL_PLATFORMS[domain] : undefined;
}

/**
 * Pages about an individual person are personal data: dropped, never stored
 * (not even their title). Company pages and job posts are kept.
 */
const PERSONAL_PAGE_PATTERNS: { host: string; path: RegExp }[] = [
  { host: "linkedin.com", path: /^\/(in|posts|pulse|feed)\// }, // profiles and personal posts
  { host: "bebee.com", path: /^\/(\w{2}\/)?people\// }, // individual profiles
  { host: "onlinejobs.ph", path: /^\/jobseekers\/info\// }, // job-seeker profiles
  { host: "upwork.com", path: /^\/freelancers\// }, // freelancer profiles
];

export function isPersonalProfileUrl(url: URL): boolean {
  return PERSONAL_PAGE_PATTERNS.some(({ host, path }) => (url.hostname === host || url.hostname.endsWith(`.${host}`)) && path.test(url.pathname));
}

/**
 * Job-board pages that list many employers ("25+ Final Expense Closer Jobs"),
 * as opposed to one job ad: their title proves the campaign for the page, not
 * for each employer on it.
 */
const LISTING_PAGE_PATH = /(^|\/)q-[^/]*jobs|\/jsearch\/|\/[a-z0-9-]+-jobs(\.html)?(\/|$)/i;

export function isListingPageUrl(url: string): boolean {
  try {
    return LISTING_PAGE_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** "Top 20 call centers…" posts are about other companies; blog and news posts aren't a service page. */
const LISTICLE_PATH = /\/(?:[^/]*[-_])?(?:top|best)[-_]\d+[-_]|\/\d+[-_](?:best|top)[-_]/i;
// Also dated paths ("/2011/09/…"): blog engines like Blogger and WordPress put posts there.
const ARTICLE_PATH = /\/(blog|news|articles?|insights|resources|posts?)\/|\/(19|20)\d{2}\/(0[1-9]|1[0-2])\//i;

/** The month a page was published, when its URL says so ("/2011/09/…"); pages often carry no other date. */
export function dateFromUrl(url: string): Date | null {
  const match = /\/((?:19|20)\d{2})\/(0[1-9]|1[0-2])\//.exec(url);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : null;
}

export type WebsitePageKind = "listicle" | "article" | "page";

export function websitePageKind(url: string): WebsitePageKind {
  try {
    const path = new URL(url).pathname;
    if (LISTICLE_PATH.test(path)) return "listicle";
    return ARTICLE_PATH.test(path) ? "article" : "page";
  } catch {
    return "page";
  }
}
