import "server-only";
import { SOURCE_POLICIES } from "@/config/sources";
import { env } from "@/lib/env";
import { exaSource } from "./exa";
import { fixtureSource } from "./fixture";
import { renderPageText, tavilySource } from "./tavily";
import type { SearchSource } from "./types";

/**
 * The discovery sources active in this environment:
 * - offline mode: the recorded sample results only
 * - live: Tavily (keyless works), plus Exa when EXA_API_KEY is set
 */
export function getSearchSources(): SearchSource[] {
  if (env().SEARCH_PROVIDER === "fixture") return [fixtureSource];
  return [tavilySource, ...(env().EXA_API_KEY ? [exaSource] : [])];
}

/** A source whose results may be stored as evidence (used by "Re-check now"). */
export function getStorableSearchSource(): SearchSource {
  const storable = getSearchSources().find((s) => SOURCE_POLICIES[s.id].storage === "storable");
  if (!storable) throw new Error("No storable search source is configured.");
  return storable;
}

export function describeSources(): string {
  return getSearchSources()
    .map((s) => s.label)
    .join(" + ");
}

/** Tavily Extract renders JavaScript-only company sites, when a key is configured and we're not offline. */
export function getPageRenderer() {
  return env().SEARCH_PROVIDER === "tavily" && env().TAVILY_API_KEY ? renderPageText : undefined;
}
