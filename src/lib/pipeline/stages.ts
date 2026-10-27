/** A search's stages, in the order they run. Safe to use in the browser. */
export const SEARCH_STAGES = ["queued", "searching", "triaging", "fetching", "classifying", "resolving", "done"] as const;
export type SearchStage = (typeof SEARCH_STAGES)[number];
