import "server-only";
import { eq } from "drizzle-orm";
import { DEPTH_PRESETS } from "@/config/limits";
import { getDb } from "@/lib/db/client";
import { searches } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { buildQueries, employerLookupQuery } from "../build-queries";
import { discover } from "../discover";
import { triage } from "../triage";
import { classifyDocs } from "./classify-docs";
import { addRuledOut, createRunContext, saveProgress, timed, type RunContext } from "./context";
import { fetchSites } from "./fetch-sites";
import { addKnownCenters } from "./results";

/**
 * Runs one search end to end. Called from `after()`, so it never blocks the request.
 *
 * known centers → search → triage → (classify snippets ∥ fetch sites) → classify sites → employer lookups
 */
export async function runSearch(searchId: string): Promise<void> {
  const db = await getDb();
  const [search] = await db.select().from(searches).where(eq(searches.id, searchId)).limit(1);
  if (!search || search.status !== "queued") return;

  let ctx: RunContext | undefined;
  try {
    ctx = createRunContext(db, search);
    await db.update(searches).set({ status: "running", startedAt: new Date(), progress: ctx.progress }).where(eq(searches.id, searchId));
    await runStages(ctx);
  } catch (error) {
    // Details go to the server log; users see a plain message (database errors can contain SQL).
    logger.error("search failed", { searchId, message: error instanceof Error ? error.message : String(error) });
    const sourceDown = ctx?.progress.sourceErrors.find((e) => e.source !== "classifier");
    await db
      .update(searches)
      .set({
        status: "failed",
        error: sourceDown ? sourceDown.message : "Something went wrong while searching.",
        finishedAt: new Date(),
        ...(ctx ? { progress: ctx.progress } : {}),
      })
      .where(eq(searches.id, searchId));
  }
}

/** The search itself, stage by stage. Any error ends up in runSearch's catch. */
async function runStages(ctx: RunContext) {
  await addKnownCenters(ctx);

  await saveProgress(ctx, "searching");
  const hits = await timed(ctx, "searching", () => discover(buildQueries(ctx.filters), ctx.filters, ctx.progress, ctx.urlsBySource));
  if (hits.length === 0 && ctx.progress.sourceErrors.length > 0) {
    throw new Error(ctx.progress.sourceErrors[0]!.message);
  }

  await saveProgress(ctx, "triaging");
  const triaged = triage(hits, ctx.filters);
  await addRuledOut(ctx, triaged.ruledOut);

  await saveProgress(ctx, "classifying");
  // Snippets (job ads, social pages) are ready now; classify them while sites download.
  const snippetWork = classifyDocs(ctx, triaged.snippetDocs.map((doc) => ({ doc })));
  await saveProgress(ctx, "fetching");
  const sites = await timed(ctx, "fetching", () => fetchSites(ctx, triaged.siteCandidates));
  await saveProgress(ctx, "classifying");
  await Promise.all([snippetWork, classifyDocs(ctx, sites)]);

  await lookUpEmployers(ctx);

  await ctx.writeQueue;
  ctx.progress.stage = "done";
  await ctx.db.update(searches).set({ status: "done", finishedAt: new Date(), progress: ctx.progress }).where(eq(searches.id, ctx.search.id));
}

/** Employers known only from job ads: search for their websites and read those too. */
async function lookUpEmployers(ctx: RunContext) {
  const lookups = ctx.employersWithoutSite.slice(0, DEPTH_PRESETS[ctx.filters.depth].employerLookups);
  if (lookups.length === 0) return;

  await saveProgress(ctx, "searching");
  const queries = lookups.map((e) => employerLookupQuery(e.name, e.city, ctx.filters));
  const hits = await timed(ctx, "searching", () => discover(queries, ctx.filters, ctx.progress, ctx.urlsBySource));
  await saveProgress(ctx, "fetching");
  const sites = await timed(ctx, "fetching", () => fetchSites(ctx, triage(hits, ctx.filters).siteCandidates));
  await classifyDocs(ctx, sites);
}
