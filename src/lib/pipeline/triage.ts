import { getDomain } from "tldts";
import { BLOCKED_DOMAINS } from "@/config/blocked-domains";
import { CAMPAIGNS, CAMPAIGN_IDS } from "@/config/campaigns";
import { isCountryId } from "@/lib/all-countries";
import { findDomainRule, type DomainKind } from "@/config/domains";
import { isPersonalProfileUrl } from "@/lib/page-kinds";
import { matchCampaign } from "@/lib/campaign-match";
import { stripPersonalData } from "@/lib/extract/personal-data";
import { findPhrase, foldAccents, sha256 } from "@/lib/text";
import { SOURCE_FOR_DOC_KIND, type Doc, type DocKind, type SearchFilters, type SearchHit } from "./types";

export interface RuledOutItem {
  url: string;
  name: string | null;
  reason: RuledOutReason;
  detail?: string;
}

export type RuledOutReason =
  | "personal_profile"
  | "not_a_company_source"
  | "blocked"
  | "no_campaign_mention"
  | "not_a_center"
  | "employer_not_named"
  | "wrong_country"
  | "campaign_not_evidenced"
  | "site_unreachable"
  | "transient_source";

export interface SiteCandidate {
  url: string;
  registeredDomain: string;
  /** Result title, only when the source allows storing it (used in the ruled-out list). */
  storableTitle: string | null;
  /** False when only a transient source (Exa) returned this site: its URL is kept only once our own fetch confirms the site. */
  fromStorableSource: boolean;
}

export interface TriageResult {
  snippetDocs: Doc[];
  siteCandidates: SiteCandidate[];
  ruledOut: RuledOutItem[];
}

const DOC_KIND_FOR_DOMAIN: Record<DomainKind, DocKind | null> = {
  social: "social",
  job_board: "job_ad",
  vendor_marketplace: "vendor_listing",
  directory: "listing",
  content: null,
};

const ANY_INSURANCE = [...CAMPAIGN_IDS.flatMap((id) => CAMPAIGNS[id].keywords), "insurance", "seguros"];

/** Job boards often put the country in the subdomain: ph.jobstreet.com, pk.indeed.com, co.computrabajo.com. */
function countryFromSubdomain(hostname: string): string | undefined {
  const first = hostname.split(".")[0];
  return first && isCountryId(first) ? first : undefined;
}

function mentions(text: string, phrases: string[]): boolean {
  const folded = foldAccents(text);
  return phrases.some((p) => findPhrase(folded, p) !== -1);
}

/**
 * Sorts raw search hits without any AI: company websites to fetch, snippets
 * we may only quote and link to (job ads, social pages, gigs, listings), and
 * hits we rule out early (saves fetches and AI calls).
 */
export function triage(hits: SearchHit[], filters: SearchFilters): TriageResult {
  const result: TriageResult = { snippetDocs: [], siteCandidates: [], ruledOut: [] };
  const seenUrls = new Set<string>();
  const seenSites = new Set<string>();

  for (const hit of hits) {
    let url: URL;
    try {
      url = new URL(hit.url);
    } catch {
      continue;
    }
    url.hash = "";
    const key = url.toString();
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);

    if (isPersonalProfileUrl(url)) {
      // Personal data: we keep no trace of the profile.
      result.ruledOut.push({ url: `https://${url.hostname}/[removed]`, name: null, reason: "personal_profile" });
      continue;
    }

    // Transient sources (e.g. Exa) may only point us at company websites, which we then read
    // ourselves. Their snippets and titles are never stored. Storable titles can end up in the
    // ruled-out list, so personal numbers and names are removed from them first.
    const storedName = hit.storable ? stripPersonalData(hit.title) : null;
    // allowPrivateDomains: "futurelinkers.blogspot.com" is its own site, not "blogspot.com".
    const registeredDomain = getDomain(url.hostname, { allowPrivateDomains: true });
    if (registeredDomain && BLOCKED_DOMAINS.includes(registeredDomain)) {
      result.ruledOut.push({ url: key, name: null, reason: "blocked" });
      continue;
    }

    const rule = findDomainRule(registeredDomain);
    const docKind = rule ? DOC_KIND_FOR_DOMAIN[rule.kind] : undefined;
    const mapping = docKind ? { kind: docKind, source: SOURCE_FOR_DOC_KIND[docKind] } : undefined;
    if (rule && (rule.access === "skip" || !mapping)) {
      // Only the URL is kept: some skipped platforms (LinkedIn) don't allow using their text at all.
      result.ruledOut.push({ url: key, name: null, reason: "not_a_company_source", detail: rule.kind });
      continue;
    }

    const text = `${hit.title}\n${hit.snippet}`;

    if (!mapping) {
      // Unknown domain: probably a company's own website. Fetch it if it looks insurance-related.
      if (!registeredDomain || seenSites.has(registeredDomain)) continue;
      if (!mentions(text, ANY_INSURANCE)) {
        result.ruledOut.push({ url: key, name: storedName, reason: "no_campaign_mention" });
        continue;
      }
      seenSites.add(registeredDomain);
      result.siteCandidates.push({ url: key, registeredDomain, storableTitle: storedName, fromStorableSource: hit.storable });
      continue;
    }

    if (!hit.storable) {
      result.ruledOut.push({ url: key, name: null, reason: "transient_source", detail: `${mapping.kind} via ${hit.sourceId}` });
      continue;
    }
    if (!matchCampaign(filters.campaign, text)) {
      result.ruledOut.push({ url: key, name: storedName, reason: "no_campaign_mention", detail: mapping.kind });
      continue;
    }

    // Listing pages ("17 Final Expense jobs") bundle several employers; Tavily separates
    // the excerpts with "[...]". Each excerpt is read on its own so employers don't blend.
    const chunks = hit.snippet.split(/\s*\[\.\.\.\]\s*/).map((c) => c.trim()).filter((c) => c.length > 20);
    const relevant = (chunks.length > 1 ? chunks : [hit.snippet]).filter((c) => chunks.length <= 1 || !!matchCampaign(filters.campaign, c));
    for (const chunk of relevant) {
      const cleaned = stripPersonalData(`${hit.title}\n${chunk}`);
      result.snippetDocs.push({
        url: key,
        registeredDomain,
        kind: mapping.kind,
        evidenceSource: mapping.source,
        title: stripPersonalData(hit.title),
        text: cleaned,
        contentHash: sha256(`${key}\n${cleaned}`),
        publishedAt: hit.publishedAt && !Number.isNaN(Date.parse(hit.publishedAt)) ? new Date(hit.publishedAt) : null,
        boardCountry: rule?.kind === "job_board" ? (rule.country ?? countryFromSubdomain(url.hostname)) : undefined,
      });
    }
  }
  return result;
}
