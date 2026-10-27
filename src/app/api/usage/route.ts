import { ok, route } from "@/lib/api/handler";
import { getClassifier } from "@/lib/ai";
import { ipHashFrom } from "@/lib/request";
import { describeSources } from "@/lib/sources";
import { getUsage } from "@/features/searches/server/usage";

/** Searches left for this visitor and today, plus which source and classifier are active. */
export const GET = route(async (request) => {
  const usage = await getUsage(ipHashFrom(request.headers));
  return ok({ ...usage, searchProvider: describeSources(), classifier: getClassifier().label });
});
