import { ok, parseParams, route } from "@/lib/api/handler";
import { recheckCenter } from "@/lib/pipeline/recheck";
import { idParamSchema } from "@/features/searches/schemas";

export const maxDuration = 60;

/** Re-reads one center's website (or searches its name) to refresh old evidence. */
export const POST = route<RouteContext<"/api/centers/[id]/recheck">>(async (_request, context) => {
  const { id } = parseParams(await context.params, idParamSchema);
  return ok(await recheckCenter(id));
});
