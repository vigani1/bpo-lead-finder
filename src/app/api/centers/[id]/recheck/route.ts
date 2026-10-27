import { ok, parseParams, route } from "@/lib/api/handler";
import { recheckCenter } from "@/lib/pipeline/recheck";
import { idParamSchema } from "@/features/searches/schemas";

/** Reading a site and one AI call (with rate-limit retries) can take more than a minute. */
export const maxDuration = 300;

/** Re-reads one center's website (or searches its name) to refresh old evidence. */
export const POST = route<RouteContext<"/api/centers/[id]/recheck">>(async (_request, context) => {
  const { id } = parseParams(await context.params, idParamSchema);
  return ok(await recheckCenter(id));
});
