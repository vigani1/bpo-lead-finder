"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, friendlyErrorMessage } from "@/lib/api-client";
import { searchKeys } from "./keys";
import type { StartSearchInput } from "./schemas";
import type { SearchView } from "./types";

export { searchKeys };

export function searchViewOptions(id: string) {
  return queryOptions({
    queryKey: searchKeys.view(id),
    queryFn: () => apiFetch<SearchView>(`/api/searches/${id}`),
    // Poll while the search runs; stop as soon as it's done or failed.
    refetchInterval: (q) => {
      const status = q.state.data?.search.status;
      return status === "queued" || status === "running" ? 2_000 : false;
    },
    staleTime: 5_000,
  });
}

export function useSearchView(id: string) {
  return useQuery(searchViewOptions(id));
}

export interface Usage {
  usedThisHour: number;
  limitPerHour: number;
  usedToday: number;
  limitPerDay: number;
}

export function useUsage() {
  return useQuery({ queryKey: searchKeys.usage, queryFn: () => apiFetch<Usage>("/api/usage"), staleTime: 30_000 });
}

export function useStartSearch() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartSearchInput) =>
      apiFetch<{ searchId: string; reused: boolean }>("/api/searches", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: ({ searchId, reused }) => {
      // A new search counts against the hourly limit shown on the form.
      if (!reused) void queryClient.invalidateQueries({ queryKey: searchKeys.usage });
      if (reused) toast("Showing a search from the last 24 hours", { description: "Use Refresh on the results page to search live again." });
      router.push(`/searches/${searchId}`);
    },
    onError: (error) => toast.error(friendlyErrorMessage(error)),
  });
}
