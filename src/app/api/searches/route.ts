import { after } from "next/server";
import { ok, parseJson, route } from "@/lib/api/handler";
import { runSearch } from "@/lib/pipeline/run";
import { ipHashFrom } from "@/lib/request";
import { startSearchSchema } from "@/features/searches/schemas";
import { startSearch } from "@/features/searches/server/start-search";

/** The pipeline runs in `after()`, bounded by this limit (seconds). */
export const maxDuration = 300;

/** Starts a search (or reuses a recent identical one) and returns at once; the page polls for progress. */
export const POST = route(async (request) => {
  const input = await parseJson(request, startSearchSchema);
  const { searchId, reused } = await startSearch(input, ipHashFrom(request.headers));
  if (!reused) after(() => runSearch(searchId));
  return ok({ searchId, reused }, { status: reused ? 200 : 202 });
});
