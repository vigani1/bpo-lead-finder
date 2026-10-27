import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { ruledOut, searches, type Search, type SearchProgress } from "@/lib/db/schema";
import { describeSources } from "@/lib/sources";
import type { UrlsBySource } from "../discover";
import type { RuledOutItem } from "../triage";
import { filtersOf, type SearchFilters } from "../types";

/** Everything one running search shares between its steps. */
export interface RunContext {
  db: Db;
  search: Search;
  filters: SearchFilters;
  /** Saved to the searches row as the search runs; the results page polls it. */
  progress: SearchProgress;
  urlsBySource: UrlsBySource;
}

export function createRunContext(db: Db, search: Search): RunContext {
  return {
    db,
    search,
    filters: filtersOf(search),
    progress: { ...search.progress, sourceStats: search.progress.sourceStats ?? {}, searchProvider: describeSources() },
    urlsBySource: new Map(),
  };
}

export async function saveProgress(ctx: RunContext, stage?: SearchProgress["stage"]) {
  if (stage) ctx.progress.stage = stage;
  await ctx.db.update(searches).set({ progress: ctx.progress }).where(eq(searches.id, ctx.search.id));
}

/** Adds the time `fn` takes to this stage's total (shown in the search stats). */
export async function timed<T>(ctx: RunContext, stage: string, fn: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    return await fn();
  } finally {
    ctx.progress.timingsMs[stage] = Math.round((ctx.progress.timingsMs[stage] ?? 0) + performance.now() - started);
  }
}

export async function addRuledOut(ctx: RunContext, items: RuledOutItem[]) {
  if (items.length === 0) return;
  await ctx.db.insert(ruledOut).values(items.map((i) => ({ searchId: ctx.search.id, url: i.url, name: i.name, reason: i.reason, detail: i.detail ?? null })));
  ctx.progress.counts.ruledOut += items.length;
}
