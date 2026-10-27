import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CAMPAIGN_IDS } from "@/config/campaigns";
import type { SearchSource } from "./types";

const fixtureSchema = z.object({
  hits: z.array(
    z.object({
      url: z.url(),
      title: z.string(),
      snippet: z.string(),
      publishedAt: z.string().nullable(),
      countries: z.array(z.string()),
      campaigns: z.array(z.enum(CAMPAIGN_IDS)),
      families: z.array(z.enum(["company", "hiring", "vendor", "social"])),
    }),
  ),
});

type Fixture = z.infer<typeof fixtureSchema>;
let cached: Fixture | undefined;

async function load(): Promise<Fixture> {
  if (cached) return cached;
  const file = await readFile(path.resolve(/*turbopackIgnore: true*/ process.cwd(), "fixtures/search-hits.json"), "utf8");
  cached = fixtureSchema.parse(JSON.parse(file));
  return cached;
}

/**
 * Offline source: real search results recorded during the feasibility check
 * (2026-10-26). Returns the recorded hits that match the filters and query
 * family, so the whole pipeline runs without any API key. Company websites
 * are still fetched live.
 */
export const fixtureSource: SearchSource = {
  id: "fixture",
  label: "Recorded sample results",
  async search(query, filters) {
    const { hits } = await load();
    const matching = hits.filter(
      (h) =>
        (filters.country === "any" || h.countries.includes(filters.country)) &&
        h.campaigns.includes(filters.campaign) &&
        (query.family === "employer_lookup" ? false : h.families.includes(query.family)),
    );
    return {
      credits: 0,
      costUsd: 0,
      hits: matching.slice(0, query.maxResults).map((h) => ({
        url: h.url,
        title: h.title,
        snippet: h.snippet,
        publishedAt: h.publishedAt,
        query,
      })),
    };
  },
};
