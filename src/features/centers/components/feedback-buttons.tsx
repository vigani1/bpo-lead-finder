"use client";

import { useMutation } from "@tanstack/react-query";
import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, friendlyErrorMessage } from "@/lib/api-client";

type Verdict = "fit" | "not_fit";

/** Reviewer feedback. Saved votes become the labelled sample for measuring accuracy. */
export function FeedbackButtons({ centerId, searchId, initial }: { centerId: string; searchId?: string; initial: { fit: number; notFit: number } }) {
  const [counts, setCounts] = useState(initial);
  const [voted, setVoted] = useState<Verdict | null>(null);
  // No cached query shows votes; the counts below are this component's own state.
  // react-doctor-disable-next-line react-doctor/query-mutation-missing-invalidation
  const vote = useMutation({
    mutationFn: (verdict: Verdict) =>
      apiFetch(`/api/centers/${centerId}/feedback`, { method: "POST", body: JSON.stringify({ verdict, searchId }) }),
    onSuccess: (_, verdict) => {
      setVoted(verdict);
      setCounts((c) => (verdict === "fit" ? { ...c, fit: c.fit + 1 } : { ...c, notFit: c.notFit + 1 }));
      toast.success("Feedback saved");
    },
    onError: (error) => toast.error(friendlyErrorMessage(error)),
  });

  return (
    <section aria-labelledby="feedback-heading" className="space-y-2">
      <h2 id="feedback-heading" className="text-sm font-medium">
        Is this a real fit?
      </h2>
      <div className="flex gap-2">
        <Button variant={voted === "fit" ? "default" : "outline"} size="sm" disabled={vote.isPending || voted !== null} onClick={() => vote.mutate("fit")}>
          <ThumbsUpIcon /> Fit
        </Button>
        <Button variant={voted === "not_fit" ? "default" : "outline"} size="sm" disabled={vote.isPending || voted !== null} onClick={() => vote.mutate("not_fit")}>
          <ThumbsDownIcon /> Not a fit
        </Button>
      </div>
      {(counts.fit > 0 || counts.notFit > 0) && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {counts.fit} said fit, {counts.notFit} said not a fit.
        </p>
      )}
    </section>
  );
}
