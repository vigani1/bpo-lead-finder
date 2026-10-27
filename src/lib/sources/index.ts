import "server-only";
import { env } from "@/lib/env";
import { exaSource } from "./exa";
import { fixtureSource } from "./fixture";
import { tavilySource } from "./tavily";
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

export function describeSources(): string {
  return getSearchSources()
    .map((s) => s.label)
    .join(" + ");
}
