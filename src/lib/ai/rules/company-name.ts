import { DOMAIN_RULES, SOCIAL_DOMAINS } from "@/config/domains";
import { ALL_COUNTRY_IDS } from "@/lib/all-countries";
import { countryLabel } from "@/config/countries";
import type { Doc } from "@/lib/pipeline/types";
import { normalizeCompanyName } from "@/lib/resolve/normalize-name";
import { foldAccents, sentenceAround } from "@/lib/text";
import { ALL_CITIES, lettersOnly } from "./matching";

// How the keyword rules find a company name, and refuse job titles, cities and platforms as names.

// Not "sales" alone: it's in real names (Sales Zone BPO); job titles with it also contain agent/closer/rep.
const ROLE_WORDS =
  /\b(closers?|representatives?|reps?|agents?|csr|specialists?|verifiers?|fronters?|qualifiers?|asesor(es)?|asistentes?|agentes?|executives?|officers?|managers?|supervisors?|leaders?|lead generation|live transfers?|campaigns?|jobs?|hiring|shift|designers?|developers?|interns?|ventas|venta|seguros|telef[oó]nico|comercial|clientes|vacantes?|empleos?|trabajos?|ofertas?)\b/i;
/** "Final Expense Call Center" is a job title, not a company. */
const CAMPAIGN_WORDS = /\b(final expense|medicare|obamacare|aca|life insurance|health insurance|seguros? de|campaign|campaña)\b/i;
/** Dates, counts and bare "Call Center": not company names. */
const NOT_A_NAME =
  /(\b(19|20)\d{2}\b|^\d+\+?$|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|^(the )?(call|contact) cent(er|re)s?$)/i;
/** A bare country name ("Pakistan") isn't a company either. */
const COUNTRY_NAMES = new Set(ALL_COUNTRY_IDS.map((id) => countryLabel(id).toLowerCase()));
/** Words that can't make a name on their own (left after legal forms and "BPO" are removed). */
const GENERIC_WORDS = new Set(["home", "based", "homebased", "part", "time", "full", "call", "center", "centre", "centers", "contact", "online", "work", "jobs", "job", "telemarketing", "outsourcing", "company", "agency", "office", "team", "us", "usa", "pakistan", "remote"]);
/** Words that make a job-ad title part look like a company. */
const COMPANY_WORD =
  /\b(bpo|solutions?|services|technologies|tech|communications|telecom|group|pvt|ltd|limited|llc|inc|corp|s\.?a\.?s\.?|advisors|agency|international|global|enterprises?|consulting|marketing|outsourcing|connect|associates|holdings|call cent(er|re)|contact cent(er|re))\b/i;
/** "Indeed", "Glassdoor", "LinkedIn"…: the platform, not the employer. */
const PLATFORM_NAMES = DOMAIN_RULES.map((r) => lettersOnly(r.domain.split(".")[0] ?? "")).filter((p) => p.length >= 4);

/**
 * Names that are really a page title, a place, a platform or a legal form:
 * "Home Based Call Center", "Karachi", "Indeed", "Private Limited". Checked for
 * every classifier's output, the AI's included.
 */
export function isPlaceholderName(candidate: string): boolean {
  const letters = lettersOnly(candidate);
  const normalized = normalizeCompanyName(candidate);
  return (
    letters.length < 2 ||
    NOT_A_NAME.test(candidate) ||
    COUNTRY_NAMES.has(candidate.trim().toLowerCase()) ||
    ALL_CITIES.includes(foldAccents(candidate)) ||
    PLATFORM_NAMES.some((p) => letters.startsWith(p)) ||
    normalized.length < 2 || // "Private Limited" alone is only a legal form
    normalized.split(" ").every((word) => GENERIC_WORDS.has(word)) // "International Call Center", "Online Bpo", "WORK"
  );
}

/** The stricter test the keyword rules apply to text they pull a name from (job titles aren't names). */
function looksLikeCompanyName(candidate: string): boolean {
  return (
    !isPlaceholderName(candidate) &&
    candidate.length <= 60 &&
    !ROLE_WORDS.test(candidate) &&
    !CAMPAIGN_WORDS.test(candidate) &&
    !/^[\w]+(-[\w]+){2,}$/.test(candidate) && // URL slugs
    !/^(we|our|the|this|hiring|now|join|apply)$/i.test(candidate)
  );
}

/** "Mars BPO Karachi" → "Mars BPO"; "Indeed Reliant BPO" / "Rawalpindi Call Center" → "Reliant BPO" / "Call Center". */
function trimName(candidate: string): string {
  const words = candidate.trim().split(/\s+/);
  const isCity = (w: string | undefined) => ALL_CITIES.includes(foldAccents(w ?? ""));
  while (words.length > 1 && isCity(words.at(-1))) words.pop();
  while (words.length > 1 && (isCity(words[0]) || PLATFORM_NAMES.includes(lettersOnly(words[0] ?? "")))) words.shift();
  return words.join(" ");
}

// Names never span lines: "[ \\t]" not "\\s", or "Rawalpindi\\nReliant BPO" would be one name.
const NAME = "([A-Z0-9][\\w&.'-]*(?:[ \\t]+[A-Z0-9][\\w&.'-]*){0,4})";
const SNIPPET_PATTERNS = [
  // "Reliant BPO is hiring…", "CM INSURANCE ADVISORS busca…"
  new RegExp(`${NAME}\\s+(?:is hiring|is looking|is expanding|busca|runs|offers)\\b`, "g"),
  // "Medicare Appointment Setter at Virtual Champs Global" (job boards list the employer after "at")
  new RegExp(`\\b(?:at|@)[ \\t]+${NAME}(?=[ \\t]*(?:[・·|,.(]|$|\\n| - | – ))`, "gm"),
  // "Join Prime BPO 5 as…"
  new RegExp(`\\b[Jj]oin\\s+(?:the\\s+)?${NAME}\\s+(?:as|team|today|now|family)\\b`, "g"),
  // Listing pages name employers bare: "…Closer – Rawalpindi. Royal bpo. Rawalpindi Satellite Town".
  new RegExp(
    "\\b([A-Z][\\w&'-]*(?:[ \\t]+[A-Z0-9][\\w&'-]*){0,3}[ \\t]+(?:BPO|Bpo|bpo|Solutions|Technologies|Communications|Telecom|Call Cent(?:er|re)s?|Contact Cent(?:er|re)|Pvt\\.? Ltd|LLC|S\\.?A\\.?S\\.?)(?:\\s+\\d{1,2})?)\\b",
    "g",
  ),
];

/** Loose "same name" test between a company name and a domain label or page handle. */
function resembles(name: string, label: string): boolean {
  const letters = lettersOnly(name);
  const target = lettersOnly(label);
  if (letters.length < 3 || target.length < 3) return false;
  const firstWord = lettersOnly(name.split(/\s+/)[0] ?? "");
  return target.includes(letters.slice(0, 5)) || letters.includes(target.slice(0, 5)) || (firstWord.length >= 4 && target.includes(firstWord));
}

const SOCIAL_HANDLE = new RegExp(`(?:${SOCIAL_DOMAINS.map((d) => d.replace(".", "\\.")).join("|")})/([\\w.-]+)/`, "i");

/** The page owner's handle in social URLs: facebook.com/amigosbpo/posts/… → "amigosbpo". */
function socialHandle(url: string): string | null {
  const match = SOCIAL_HANDLE.exec(url);
  const handle = match?.[1];
  return handle && !["p", "groups", "reel", "watch", "story.php", "permalink.php", "people"].includes(handle.toLowerCase()) ? handle : null;
}

interface NameFinding {
  name: string;
  /** Where the name appears, quoted from the document so it can be verified and shown. */
  quote: string | null;
}

/**
 * Company name, or null when the document doesn't name one (better than a guess:
 * the pipeline rules it out as "employer not named").
 *
 * - Snippets (job ads, social posts, gigs): explicit phrasings first; job-ad titles
 *   ("Role - Company - City") only if a part contains a company-type word.
 * - Social posts: never the title (it's the post, not a company), except company pages;
 *   and the name must match the page's own handle, or a recruiter's page could name someone else.
 * - Websites: of the JSON-LD name, site name and title parts, prefer the one that matches the domain.
 */
export function companyName(doc: Doc): NameFinding | null {
  if (doc.kind !== "website") {
    for (const pattern of SNIPPET_PATTERNS) {
      for (const match of doc.text.matchAll(pattern)) {
        const candidate = trimName(match[1] ?? "");
        if (!looksLikeCompanyName(candidate)) continue;
        const handle = doc.kind === "social" ? socialHandle(doc.url) : null;
        if (handle && !resembles(candidate, handle)) return null;
        return { name: candidate, quote: sentenceAround(doc.text, match.index ?? 0) };
      }
    }
    if (doc.kind === "social" && !/linkedin\.com\/company\//.test(doc.url)) return null;
  }

  // "Orbix Bpo| Scalable BPO Solutions" and "Prime BPO - FE Closer - Rawalpindi" both split.
  const titleParts = doc.title.split(/\s*[|–—]\s*|\s[-:]\s/).map((p) => trimName(p)).filter(Boolean);
  if (doc.kind === "job_ad" || doc.kind === "vendor_listing") {
    const fromTitle = titleParts.filter(looksLikeCompanyName).find((p) => COMPANY_WORD.test(p));
    return fromTitle ? { name: fromTitle, quote: doc.title } : null;
  }

  const candidates = [doc.facts?.jsonLdName, doc.facts?.siteName, ...titleParts].filter(
    (c): c is string => !!c && looksLikeCompanyName(c),
  );
  const domainLabel = doc.registeredDomain?.split(".")[0] ?? "";
  // "Professional Telemarketing & BPO Services" (a tagline) loses to "Sales Zone BPO" on saleszonebpo.com.
  const best = (domainLabel && candidates.find((c) => resembles(c, domainLabel))) || candidates[0];
  if (!best) return null;
  return { name: best, quote: titleParts.includes(best) ? doc.title : null };
}
