import "server-only";
import { eq } from "drizzle-orm";
import { notFound } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { centers, feedback, searches } from "@/lib/db/schema";

/** Saves one reviewer vote; votes are the labelled sample for measuring accuracy. */
export async function addFeedback(centerId: string, input: { verdict: "fit" | "not_fit"; reason?: string; searchId?: string }) {
  const db = await getDb();
  const [center] = await db.select({ id: centers.id }).from(centers).where(eq(centers.id, centerId)).limit(1);
  if (!center) throw notFound("Center");
  if (input.searchId) {
    const [search] = await db.select({ id: searches.id }).from(searches).where(eq(searches.id, input.searchId)).limit(1);
    if (!search) throw notFound("Search");
  }
  await db.insert(feedback).values({ centerId, verdict: input.verdict, reason: input.reason ?? null, searchId: input.searchId ?? null });
  return { ok: true };
}
