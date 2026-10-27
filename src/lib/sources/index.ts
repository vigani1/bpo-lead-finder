import "server-only";
import { env } from "@/lib/env";
import { exaSource } from "./exa";
import { tavilySource } from "./tavily";
import type { SearchSource } from "./types";

/** The discovery sources active in this environment: Tavily (keyless works), plus Exa when EXA_API_KEY is set. */
export function getSearchSources(): SearchSource[] {
  return [tavilySource, ...(env().EXA_API_KEY ? [exaSource] : [])];
}

export function describeSources(): string {
  return getSearchSources()
    .map((s) => s.label)
    .join(" + ");
}
