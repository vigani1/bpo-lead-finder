import "server-only";
import { eq } from "drizzle-orm";
import { notFound } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { searches } from "@/lib/db/schema";
import type { SearchView } from "../types";
import { toSummary } from "./summary";

/** The search page's data: status and progress. Polled every 2 seconds while a search is live. */
export async function getSearchView(searchId: string): Promise<SearchView> {
  const db = await getDb();
  const [search] = await db.select().from(searches).where(eq(searches.id, searchId)).limit(1);
  if (!search) throw notFound("Search");
  return { search: toSummary(search, new Date()) };
}
