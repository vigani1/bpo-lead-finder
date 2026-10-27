import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { LIMITS } from "@/config/limits";
import type { Db } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { searches } from "@/lib/db/schema";

/** New searches by this visitor in the last hour, and by everyone today: the two rate limits. */
export async function countRecentSearches(db: Db, ipHash: string): Promise<{ thisHour: number; today: number }> {
  const now = Date.now();
  const [[hour], [day]] = await Promise.all([
    db.select({ n: count() }).from(searches).where(and(eq(searches.ipHash, ipHash), gte(searches.createdAt, new Date(now - 3_600_000)))),
    db.select({ n: count() }).from(searches).where(gte(searches.createdAt, new Date(now - 86_400_000))),
  ]);
  return { thisHour: hour?.n ?? 0, today: day?.n ?? 0 };
}

export async function getUsage(ipHash: string) {
  const used = await countRecentSearches(await getDb(), ipHash);
  return {
    usedThisHour: used.thisHour,
    limitPerHour: LIMITS.searchesPerHour,
    usedToday: used.today,
    limitPerDay: LIMITS.searchesPerDay,
  };
}
