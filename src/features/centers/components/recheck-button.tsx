"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { searchKeys } from "@/features/searches/keys";
import { apiFetch, friendlyErrorMessage } from "@/lib/api-client";

/** Refreshes this center's evidence (website re-read, or a name search) and reloads the page. */
export function RecheckButton({ centerId, hasWebsite }: { centerId: string; hasWebsite: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const recheck = useMutation({
    mutationFn: () => apiFetch<{ newEvidence: number }>(`/api/centers/${centerId}/recheck`, { method: "POST" }),
    onSuccess: ({ newEvidence }) => {
      toast.success(newEvidence > 0 ? `Re-checked: ${newEvidence} new piece${newEvidence === 1 ? "" : "s"} of evidence` : "Re-checked: nothing new");
      // New evidence can change this center's score in any search it appears in.
      void queryClient.invalidateQueries({ queryKey: searchKeys.all });
      router.refresh();
    },
    onError: (error) => toast.error(friendlyErrorMessage(error)),
  });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" onClick={() => recheck.mutate()} disabled={recheck.isPending}>
          <RefreshCwIcon className={recheck.isPending ? "animate-spin" : undefined} />
          {recheck.isPending ? "Re-checking…" : "Re-check now"}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hasWebsite ? "Read the website again" : "Search for this center’s name again"}</TooltipContent>
    </Tooltip>
  );
}
