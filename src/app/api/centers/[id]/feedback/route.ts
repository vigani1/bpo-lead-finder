import { ok, parseJson, parseParams, route } from "@/lib/api/handler";
import { addFeedback } from "@/features/centers/server/feedback";
import { feedbackSchema } from "@/features/centers/schemas";
import { idParamSchema } from "@/features/searches/schemas";

/** "Fit / Not a fit" votes. They double as the labelled sample for the evaluation. */
export const POST = route<RouteContext<"/api/centers/[id]/feedback">>(async (request, context) => {
  const { id } = parseParams(await context.params, idParamSchema);
  const input = await parseJson(request, feedbackSchema);
  return ok(await addFeedback(id, input), { status: 201 });
});
