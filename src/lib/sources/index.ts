import "server-only";
import { tavilySource } from "./tavily";
import type { SearchSource } from "./types";

/** The discovery sources active in this environment: Tavily (keyless works). */
export function getSearchSources(): SearchSource[] {
  return [tavilySource];
}

export function describeSources(): string {
  return getSearchSources()
    .map((s) => s.label)
    .join(" + ");
}
