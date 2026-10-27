import { ok, parseParams, route } from "@/lib/api/handler";
import { idParamSchema } from "@/features/searches/schemas";
import { getSearchView } from "@/features/searches/server/search-view";

/** Status and progress. Polled while the search runs. */
export const GET = route<RouteContext<"/api/searches/[id]">>(async (_request, context) => {
  const { id } = parseParams(await context.params, idParamSchema);
  return ok(await getSearchView(id));
});
