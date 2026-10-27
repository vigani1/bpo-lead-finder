import { ok, route } from "@/lib/api/handler";
import { ipHashFrom } from "@/lib/request";
import { getUsage } from "@/features/searches/server/usage";

/** Searches left for this visitor and today. */
export const GET = route(async (request) => {
  return ok(await getUsage(ipHashFrom(request.headers)));
});
