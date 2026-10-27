import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { SOURCE_POLICIES, type SourceId } from "@/config/sources";
import type { SearchSummary } from "@/features/searches/types";
import { formatDuration } from "@/lib/format";
import { SEARCH_STAGES } from "@/lib/pipeline/stages";
import { cn } from "@/lib/utils";

/** The pipeline really is a sequence, so the steps are shown in order. */
const STEPS = [
  { stage: "searching", label: "Searching sources" },
  { stage: "fetching", label: "Reading company websites" },
  { stage: "classifying", label: "Checking evidence" },
  { stage: "done", label: "Done" },
] as const;

const ORDER: readonly string[] = SEARCH_STAGES;

export function SearchProgressBar({ search }: { search: SearchSummary }) {
  const { counts, stage } = search.progress;
  const current = ORDER.indexOf(stage);
  return (
    <div className="rounded-lg border bg-card p-4" aria-live="polite">
      <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {STEPS.map((step) => {
          const index = ORDER.indexOf(step.stage);
          const done = current > index || stage === "done";
          const active = !done && (current === index || (step.stage === "classifying" && stage === "resolving"));
          return (
            <li key={step.stage} className={cn("flex items-center gap-2", done || active ? "text-foreground" : "text-muted-foreground")}>
              {done ? (
                <CheckIcon className="size-4 text-confidence-high" />
              ) : active ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <span className="size-4 rounded-full border" />
              )}
              {step.label}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-muted-foreground tabular-nums">
        {counts.queries} searches, {counts.hits} results, {counts.fetchedPages} pages read, {counts.classified} checked, {counts.matched} centers so far.
      </p>
    </div>
  );
}

export function SearchStats({ search }: { search: SearchSummary }) {
  const { counts, timingsMs, classifier, searchProvider } = search.progress;
  const sourceStats = Object.entries(search.progress.sourceStats ?? {});
  return (
    <footer className="space-y-1 border-t pt-4 text-xs leading-relaxed text-muted-foreground tabular-nums">
      <p>
        {counts.queries} searches via {searchProvider || "search API"}, {counts.hits} results, {counts.fetchedPages} pages read,{" "}
        {counts.classified} documents checked by {classifier || "classifier"}, {counts.claimsDropped} unverifiable claims dropped.
      </p>
      {sourceStats.length > 1 && (
        <p>
          By source:{" "}
          {sourceStats
            .map(([id, s]) => `${SOURCE_POLICIES[id as SourceId]?.label ?? id} ${s?.queries ?? 0} searches, ${s?.hits ?? 0} results (${s?.onlyHere ?? 0} found only there)`)
            .join("; ")}
          .
        </p>
      )}
      <p>
        Time: search {formatDuration(timingsMs.searching)}, websites {formatDuration(timingsMs.fetching)}, checking{" "}
        {formatDuration(timingsMs.classifying)}.
      </p>
    </footer>
  );
}
