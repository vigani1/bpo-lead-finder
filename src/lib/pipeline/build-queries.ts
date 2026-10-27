import { CAMPAIGNS } from "@/config/campaigns";
import { getCountry } from "@/lib/all-countries";
import { EXCLUDED_SEARCH_DOMAINS, JOB_BOARD_DOMAINS, SOCIAL_DOMAINS, VENDOR_DOMAINS } from "@/config/domains";
import { DEPTH_PRESETS } from "@/config/limits";
import { MARKETS } from "@/config/markets";
import type { DiscoveryQuery, QueryFamily, SearchFilters } from "./types";

/**
 * Turns filters into search queries, by family: company websites, job ads,
 * vendor listings and social pages. Phrasings come from what worked in the
 * feasibility check (e.g. Pakistani hiring terms, Spanish product terms).
 */
export function buildQueries(filters: SearchFilters): DiscoveryQuery[] {
  const preset = DEPTH_PRESETS[filters.depth];
  const campaign = CAMPAIGNS[filters.campaign];
  const country = filters.country === "any" ? undefined : getCountry(filters.country);
  const spanish = filters.market === "spanish" || filters.market === "bilingual" || country?.language === "es";
  const enTerm = campaign.searchTerms.en[0]!;
  const esTerm = campaign.searchTerms.es[0]!;
  const marketTerm = filters.market === "any" || filters.market === "english" ? "" : (MARKETS[filters.market].searchTerms[0] ?? "");
  const place = country?.label ?? "offshore";
  const cities = country?.cities.slice(0, filters.depth === "quick" ? 2 : 4) ?? [];
  const hiringTerm = country?.hiringTerms[0] ?? "closer";

  // Tavily returns nothing when a country boost is combined with a domain filter, so the boost
  // only goes on unrestricted queries (company websites).
  const base = { maxResults: preset.resultsPerQuery };
  const boost = { countryBoost: country?.tavilyCountry };
  const companyExclusions = [...EXCLUDED_SEARCH_DOMAINS, ...JOB_BOARD_DOMAINS, ...VENDOR_DOMAINS, ...SOCIAL_DOMAINS];

  const byFamily: Record<QueryFamily, DiscoveryQuery[]> = {
    company: [],
    company_profile: [],
    hiring: [],
    vendor: [],
    social: [],
    employer_lookup: [],
  };
  const join = (...parts: string[]) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  for (const city of cities.length ? cities : [""]) {
    byFamily.company.push({
      ...base,
      ...boost,
      family: "company",
      text: join(enTerm, "call center", city || place, "BPO campaigns", marketTerm),
      excludeDomains: companyExclusions,
    });
    byFamily.hiring.push({
      ...base,
      family: "hiring",
      text: join(enTerm, hiringTerm, "job", city || place, marketTerm),
      includeDomains: JOB_BOARD_DOMAINS,
    });
    if (spanish) {
      byFamily.hiring.push({
        ...base,
        family: "hiring",
        // Quoted product term: without it Spanish boards return generic "agente en español" jobs.
        text: join("call center", `"${esTerm}"`, "Estados Unidos", city || place),
        includeDomains: JOB_BOARD_DOMAINS,
      });
    }
  }

  byFamily.vendor.push({ ...base, family: "vendor", text: join(enTerm, "live transfers", place, "call center"), includeDomains: VENDOR_DOMAINS });
  byFamily.social.push({ ...base, family: "social", text: join(enTerm, "call center", place, marketTerm), includeDomains: SOCIAL_DOMAINS });

  // Interleave families so a small budget still covers every kind of source.
  const order: QueryFamily[] = ["hiring", "company", "social", "hiring", "company", "vendor"];
  const queries: DiscoveryQuery[] = [];
  const seen = new Set<string>();
  while (queries.length < preset.maxQueries && order.some((f) => byFamily[f].length > 0)) {
    for (const family of order) {
      const next = byFamily[family].shift();
      if (!next || seen.has(next.text) || queries.length >= preset.maxQueries) continue;
      seen.add(next.text);
      queries.push(next);
    }
  }
  // One plain-sentence query for Exa's company search, which finds company sites the keyword queries miss.
  queries.push({
    family: "company_profile",
    text: `${country ? `call center companies in ${cities[0] ?? place}` : "offshore call center companies"} that run ${enTerm} campaigns for US clients`,
    maxResults: preset.resultsPerQuery,
  });
  return queries;
}

/** One extra search to find the footprint (website) of an employer named in a job ad. */
export function employerLookupQuery(name: string, city: string | null, filters: SearchFilters): DiscoveryQuery {
  const country = filters.country === "any" ? undefined : getCountry(filters.country);
  return {
    family: "employer_lookup",
    text: `"${name}" ${city ?? country?.label ?? ""} call center`.trim(),
    maxResults: 5,
    excludeDomains: [...EXCLUDED_SEARCH_DOMAINS, ...VENDOR_DOMAINS],
  };
}
