import "server-only";
import { desc } from "drizzle-orm";
import { filtersOf } from "@/lib/pipeline/types";
import { LIMITS } from "@/config/limits";
import { getDb } from "@/lib/db/client";
import { searches, type Search } from "@/lib/db/schema";
import type { SearchSummary } from "../types";

export function toSummary(search: Search, now: Date): SearchSummary {
  // A search stuck in "running" (e.g. the server restarted) is shown as timed out.
  const stale =
    (search.status === "running" || search.status === "queued") &&
    now.getTime() - (search.startedAt ?? search.createdAt).getTime() > LIMITS.staleSearchMinutes * 60_000;
  return {
    id: search.id,
    ...filtersOf(search),
    status: stale ? "failed" : search.status,
    progress: search.progress,
    error: stale ? "The search timed out. Try running it again." : search.error,
    createdAt: search.createdAt.toISOString(),
    finishedAt: search.finishedAt?.toISOString() ?? null,
  };
}

export async function listRecentSearches(limit = 8): Promise<SearchSummary[]> {
  const db = await getDb();
  const rows = await db.select().from(searches).orderBy(desc(searches.createdAt)).limit(limit);
  const now = new Date();
  return rows.map((r) => toSummary(r, now));
}
