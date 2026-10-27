import "server-only";
import pLimit from "p-limit";
import { DEPTH_PRESETS, LIMITS } from "@/config/limits";
import { getPageRenderer } from "@/lib/sources";
import { fetchSite, type FetchedSite } from "../fetch-site";
import type { RuledOutItem, SiteCandidate } from "../triage";
import type { Doc } from "../types";
import { addRuledOut, type RunContext } from "./context";

/** Reads candidate company websites in parallel (up to the depth's budget); unreachable ones are ruled out. */
export async function fetchSites(ctx: RunContext, candidates: SiteCandidate[]): Promise<{ doc: Doc; site: FetchedSite }[]> {
  const preset = DEPTH_PRESETS[ctx.filters.depth];
  const limit = pLimit(LIMITS.concurrency.fetch);
  const render = getPageRenderer();
  const out: { doc: Doc; site: FetchedSite }[] = [];
  const unreachable: RuledOutItem[] = [];
  await Promise.all(
    candidates.slice(0, preset.maxSitesToFetch).map((candidate) =>
      limit(async () => {
        const site = await fetchSite(ctx.db, candidate, { pagesPerSite: preset.pagesPerSite, render });
        ctx.progress.counts.fetchedPages += site.pagesFetched;
        ctx.progress.costs.searchCredits += site.renderCredits;
        if (site.doc) out.push({ doc: site.doc, site });
        // A site only a transient source pointed to leaves no trace unless we could read it ourselves.
        else if (candidate.fromStorableSource) {
          unreachable.push({ url: candidate.url, name: candidate.storableTitle, reason: "site_unreachable", detail: site.websiteStatus });
        }
      }),
    ),
  );
  await addRuledOut(ctx, unreachable);
  return out;
}
