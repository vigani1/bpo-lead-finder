import { z } from "zod";
import { ok, parseParams, parseQuery, route } from "@/lib/api/handler";
import { getCenterView } from "@/features/centers/server/center-view";
import { idParamSchema, resultsQuerySchema } from "@/features/searches/schemas";

const querySchema = z.object({ searchId: z.uuid().optional(), maxAge: resultsQuerySchema.shape.maxAge });

/** One center: contacts, evidence with sources, and the score breakdown for a search. */
export const GET = route<RouteContext<"/api/centers/[id]">>(async (request, context) => {
  const { id } = parseParams(await context.params, idParamSchema);
  const { searchId, maxAge } = parseQuery(request, querySchema);
  return ok(await getCenterView(id, { searchId, maxAge }));
});
