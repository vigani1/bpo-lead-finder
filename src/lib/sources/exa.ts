import "server-only";
import Exa, { ExaError } from "exa-js";
import { env } from "@/lib/env";
import { SourceLimitError, type SearchSource } from "./types";

let client: Exa | undefined;

function getClient(): Exa {
  client ??= new Exa(env().EXA_API_KEY);
  return client;
}

/**
 * Exa search (its own index, separate from Tavily's). Request follows Exa's
 * recommended shape: query + `type: "auto"` + `contents.highlights`, nothing
 * else unless needed. Domain filters are passed only when our approved lists in
 * `src/config/domains.ts` apply to the query (e.g. leave out job boards when
 * looking for company websites).
 *
 * Results are transient (see `src/config/sources.ts`): the highlights only help
 * triage pick company websites; they are never stored.
 */
export const exaSource: SearchSource = {
  id: "exa",
  label: "Exa",
  async search(query) {
    try {
      const response = await getClient().search(query.text, {
        type: "auto",
        contents: { highlights: true },
        numResults: query.maxResults,
        ...(query.includeDomains?.length ? { includeDomains: query.includeDomains } : {}),
        ...(query.excludeDomains?.length ? { excludeDomains: query.excludeDomains } : {}),
      });
      return {
        credits: 0,
        costUsd: response.costDollars?.total ?? 0,
        hits: response.results.map((r) => ({
          url: r.url,
          title: r.title ?? "",
          // Excerpts separated like Tavily's, so triage reads each one on its own.
          snippet: (r.highlights ?? []).join(" [...] "),
          publishedAt: r.publishedDate ?? null,
          query,
        })),
      };
    } catch (error) {
      if (error instanceof ExaError && (error.statusCode === 429 || error.statusCode === 402)) {
        throw new SourceLimitError("exa", `Exa limit reached (${error.statusCode}): ${error.message}`);
      }
      throw error;
    }
  },
};
