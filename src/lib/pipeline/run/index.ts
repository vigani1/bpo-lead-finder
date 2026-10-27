import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { searches } from "@/lib/db/schema";

/**
 * Runs one search. Called from `after()`, so it never blocks the request.
 * There are no pipeline stages yet: the search is marked done straight away.
 */
export async function runSearch(searchId: string): Promise<void> {
  const db = await getDb();
  const [search] = await db.select().from(searches).where(eq(searches.id, searchId)).limit(1);
  if (!search || search.status !== "queued") return;

  const now = new Date();
  await db
    .update(searches)
    .set({ status: "done", startedAt: now, finishedAt: now, progress: { ...search.progress, stage: "done" } })
    .where(eq(searches.id, searchId));
}
