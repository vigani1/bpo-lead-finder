import { ok, route } from "@/lib/api/handler";
import { getFilterOptions } from "@/features/meta/filter-options";

/** Filter options, straight from `src/config`. */
export const GET = route(async () => ok(getFilterOptions()));
