import type { ResultsQueryInput } from "./schemas";

/** React Query keys in one place, shared by the server prefetch and the client hooks. */
export const searchKeys = {
  all: ["searches"] as const,
  view: (id: string, query: ResultsQueryInput) => ["searches", id, query] as const,
  usage: ["usage"] as const,
};

export function toSearchParams(query: ResultsQueryInput): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, String(value));
  }
  return params;
}
