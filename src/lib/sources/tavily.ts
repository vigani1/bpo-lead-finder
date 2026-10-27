import "server-only";
import { tavily, TavilyKeylessLimitError, type TavilyClient } from "@tavily/core";
import { UNIT_COSTS_USD } from "@/config/limits";
import { env } from "@/lib/env";
import { SourceLimitError, type SearchSource } from "./types";

let client: TavilyClient | undefined;

function getClient(): TavilyClient {
  // Without a key the SDK runs in Tavily's keyless mode (small hourly/daily caps).
  client ??= tavily({ apiKey: env().TAVILY_API_KEY, clientName: "call-center-lead-finder" });
  return client;
}

/**
 * Tavily search. We only ever use the normal result (title, URL, snippet):
 * never `includeRawContent` or Extract for sites whose terms forbid automated
 * access, since that would just be scraping them through someone else.
 */
export const tavilySource: SearchSource = {
  id: "tavily",
  get label() {
    return env().TAVILY_API_KEY ? "Tavily" : "Tavily (keyless)";
  },
  async search(query) {
    try {
      const response = await getClient().search(query.text, {
        searchDepth: "basic",
        maxResults: query.maxResults,
        includeDomains: query.includeDomains,
        excludeDomains: query.excludeDomains,
        country: query.countryBoost,
        includeRawContent: false,
        includeAnswer: false,
        includeUsage: true,
      });
      const credits = response.usage?.credits ?? 1;
      return {
        credits,
        costUsd: credits * UNIT_COSTS_USD.tavilyCredit,
        hits: response.results.map((r) => ({
          url: r.url,
          title: r.title,
          snippet: r.content,
          publishedAt: r.publishedDate || null,
          query,
        })),
      };
    } catch (error) {
      if (error instanceof TavilyKeylessLimitError) {
        throw new SourceLimitError(
          "tavily",
          "Tavily's keyless limit was reached. Add a free TAVILY_API_KEY for more searches.",
          error.retryAfter ?? undefined,
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      if (/429|rate limit|usage limit|credits/i.test(message)) throw new SourceLimitError("tavily", `Tavily limit: ${message}`);
      throw error;
    }
  },
};
