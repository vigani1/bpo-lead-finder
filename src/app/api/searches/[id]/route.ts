import { ok, parseParams, parseQuery, route } from "@/lib/api/handler";
import { idParamSchema, resultsQuerySchema } from "@/features/searches/schemas";
import { getSearchView } from "@/features/searches/server/search-view";

/** Status, progress and (re-scored, filtered) results. Polled while the search runs. */
export const GET = route<RouteContext<"/api/searches/[id]">>(async (request, context) => {
  const { id } = parseParams(await context.params, idParamSchema);
  const query = parseQuery(request, resultsQuerySchema);
  return ok(await getSearchView(id, query));
});
