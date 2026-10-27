/**
 * What we know about domains that show up in search results, and what we're
 * allowed to do with them. Checked against robots.txt and terms on 2026-10-26.
 *
 * - `snippet_only`: use the search result (title, URL, snippet) and link to it; never fetch.
 * - `skip`: drop the result entirely (only the URL is kept, in the ruled-out list).
 */
export type DomainKind = "social" | "job_board" | "vendor_marketplace" | "directory" | "content";
export type DomainAccess = "snippet_only" | "skip";

export interface DomainRule {
  domain: string;
  kind: DomainKind;
  access: DomainAccess;
  /** Country the board serves, used as a location signal. */
  country?: string;
  /** Display name for social platforms ("Facebook"). */
  label?: string;
}

export const DOMAIN_RULES: DomainRule[] = [
  // Social platforms: terms forbid automated collection → link only.
  // LinkedIn's User Agreement §8.2 (2025-11-03) also covers information obtained "through third parties
  // (such as search tools…)", so not even its search snippets are used.
  { domain: "linkedin.com", kind: "social", access: "skip", label: "LinkedIn" },
  { domain: "facebook.com", kind: "social", access: "snippet_only", label: "Facebook" },
  { domain: "instagram.com", kind: "social", access: "snippet_only", label: "Instagram" },
  { domain: "x.com", kind: "social", access: "snippet_only", label: "X" },
  { domain: "twitter.com", kind: "social", access: "snippet_only", label: "X" },
  { domain: "youtube.com", kind: "social", access: "skip", label: "YouTube" },
  { domain: "tiktok.com", kind: "social", access: "skip", label: "TikTok" },

  // Job boards: most terms forbid automated access → search snippet + link.
  { domain: "mustakbil.com", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "rozee.pk", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "iwork4sindh.com", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "jobz.pk", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "qureos.com", kind: "job_board", access: "snippet_only" },
  { domain: "taraki.co", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "indeed.com", kind: "job_board", access: "snippet_only" },
  { domain: "glassdoor.com", kind: "job_board", access: "snippet_only" },
  { domain: "jobstreet.com.ph", kind: "job_board", access: "snippet_only", country: "ph" },
  { domain: "jobstreet.com", kind: "job_board", access: "snippet_only" },
  { domain: "onlinejobs.ph", kind: "job_board", access: "snippet_only", country: "ph" },
  { domain: "kalibrr.com", kind: "job_board", access: "snippet_only", country: "ph" },
  { domain: "bossjob.ph", kind: "job_board", access: "snippet_only", country: "ph" },
  { domain: "philjobnet.gov.ph", kind: "job_board", access: "snippet_only", country: "ph" },
  { domain: "naukri.com", kind: "job_board", access: "skip", country: "in" },
  { domain: "teamlease.com", kind: "job_board", access: "snippet_only", country: "in" },
  { domain: "weekday.works", kind: "job_board", access: "snippet_only", country: "in" },
  { domain: "computrabajo.com", kind: "job_board", access: "snippet_only" },
  { domain: "elempleo.com", kind: "job_board", access: "snippet_only", country: "co" },
  { domain: "occ.com.mx", kind: "job_board", access: "snippet_only", country: "mx" },
  { domain: "cazvid.com", kind: "job_board", access: "snippet_only" },
  { domain: "jooble.org", kind: "job_board", access: "snippet_only" },
  { domain: "careers24.com", kind: "job_board", access: "snippet_only" },
  { domain: "bayt.com", kind: "job_board", access: "snippet_only" },
  // Aggregators seen in live Tavily results (2026-10-26).
  { domain: "bebee.com", kind: "job_board", access: "snippet_only" },
  { domain: "jobleads.com", kind: "job_board", access: "snippet_only" },
  { domain: "touchstonejobs.pk", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "searchopal.com", kind: "job_board", access: "snippet_only" },
  { domain: "jobrapido.com", kind: "job_board", access: "snippet_only" },
  { domain: "careerjet.com", kind: "job_board", access: "snippet_only" },
  { domain: "talent.com", kind: "job_board", access: "snippet_only" },
  { domain: "simplyhired.com", kind: "job_board", access: "snippet_only" },
  { domain: "ziprecruiter.com", kind: "job_board", access: "snippet_only" },
  { domain: "jobsora.com", kind: "job_board", access: "snippet_only" },
  { domain: "adzuna.com", kind: "job_board", access: "snippet_only" },
  { domain: "whatjobs.com", kind: "job_board", access: "snippet_only" },
  { domain: "mustakbil.pk", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "jobsalert.pk", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "pakistanjobsbank.com", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "getpakjob.com", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "jobsinpakistan.pk", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "paperpk.com", kind: "job_board", access: "snippet_only", country: "pk" },
  { domain: "workable.com", kind: "job_board", access: "snippet_only" },
  { domain: "pandape.computrabajo.com", kind: "job_board", access: "snippet_only" },
  { domain: "tally.so", kind: "content", access: "skip" },

  // Freelance marketplaces: self-claimed, often individuals or resellers.
  { domain: "fiverr.com", kind: "vendor_marketplace", access: "snippet_only" },
  { domain: "upwork.com", kind: "vendor_marketplace", access: "snippet_only" },
  { domain: "freelancer.com", kind: "vendor_marketplace", access: "snippet_only" },
  { domain: "freelancer.de", kind: "vendor_marketplace", access: "snippet_only" },
  { domain: "peopleperhour.com", kind: "vendor_marketplace", access: "snippet_only" },

  // Directories and data vendors: list general BPOs; link only.
  { domain: "clutch.co", kind: "directory", access: "snippet_only" },
  { domain: "goodfirms.co", kind: "directory", access: "snippet_only" },
  { domain: "designrush.com", kind: "directory", access: "snippet_only" },
  { domain: "outsourceaccelerator.com", kind: "directory", access: "snippet_only" },
  { domain: "themanifest.com", kind: "directory", access: "snippet_only" },
  { domain: "sortlist.com", kind: "directory", access: "snippet_only" },
  { domain: "kompass.com", kind: "directory", access: "snippet_only" },
  { domain: "europages.com", kind: "directory", access: "skip" },
  { domain: "revenuebase.ai", kind: "directory", access: "snippet_only" },
  { domain: "marketers1.com", kind: "directory", access: "snippet_only" },
  { domain: "justdial.com", kind: "directory", access: "snippet_only" },
  { domain: "crunchbase.com", kind: "directory", access: "snippet_only" },
  { domain: "zoominfo.com", kind: "directory", access: "skip" },
  { domain: "apollo.io", kind: "directory", access: "skip" },
  { domain: "rocketreach.co", kind: "directory", access: "skip" },

  // Messaging links (click-to-chat) point at a person's account: personal data, always skipped.
  { domain: "wa.me", kind: "content", access: "skip" },
  { domain: "whatsapp.com", kind: "content", access: "skip" },
  { domain: "t.me", kind: "content", access: "skip" },
  { domain: "telegram.me", kind: "content", access: "skip" },

  // Content, forums, news and SEO listicles: never a center themselves.
  { domain: "reddit.com", kind: "content", access: "skip" },
  { domain: "quora.com", kind: "content", access: "skip" },
  { domain: "insurance-forums.com", kind: "content", access: "skip" },
  { domain: "medium.com", kind: "content", access: "skip" },
  { domain: "scribd.com", kind: "content", access: "skip" },
  { domain: "wikipedia.org", kind: "content", access: "skip" },
  { domain: "callin.io", kind: "content", access: "skip" },
  { domain: "nearshoreamericas.com", kind: "content", access: "skip" },
  { domain: "businesswire.com", kind: "content", access: "skip" },
  { domain: "prnewswire.com", kind: "content", access: "skip" },
  { domain: "pressreleasepoint.com", kind: "content", access: "skip" },
  { domain: "einpresswire.com", kind: "content", access: "skip" },
  { domain: "openpr.com", kind: "content", access: "skip" },
  { domain: "prlog.org", kind: "content", access: "skip" },
  { domain: "issuewire.com", kind: "content", access: "skip" },
  { domain: "erlang.com", kind: "content", access: "skip" },
  { domain: "exa.ai", kind: "content", access: "skip" },
  { domain: "balitech.org", kind: "content", access: "skip" },
  { domain: "31west.net", kind: "content", access: "skip" },
];

/** Domains the search API should never return (SEO spam and boards we skip). */
export const EXCLUDED_SEARCH_DOMAINS = DOMAIN_RULES.filter((r) => r.access === "skip").map((r) => r.domain);

export const JOB_BOARD_DOMAINS = DOMAIN_RULES.filter((r) => r.kind === "job_board" && r.access !== "skip").map((r) => r.domain);
/** Social platforms we search (the brief names Facebook and Instagram); others are only linked when found. */
export const SOCIAL_DOMAINS = ["facebook.com", "instagram.com"];
export const VENDOR_DOMAINS = DOMAIN_RULES.filter((r) => r.kind === "vendor_marketplace" && r.access !== "skip").map((r) => r.domain);

/** "facebook.com" → "Facebook", for every social platform (also ones we only link to, like LinkedIn). */
export const SOCIAL_PLATFORMS: Record<string, string> = Object.fromEntries(
  DOMAIN_RULES.filter((r) => r.kind === "social" && r.label).map((r) => [r.domain, r.label!]),
);

export function findDomainRule(registeredDomain: string | null): DomainRule | undefined {
  if (!registeredDomain) return undefined;
  return DOMAIN_RULES.find((r) => registeredDomain === r.domain || registeredDomain.endsWith(`.${r.domain}`));
}
