import Link from "next/link";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { CenterView } from "@/features/centers/types";
import { cn } from "@/lib/utils";

/** Every applicable signal with points earned out of available: no score without its reasons. */
export function ScoreBreakdown({ scoring }: { scoring: NonNullable<CenterView["scoring"]> }) {
  return (
    <section aria-labelledby="score-heading" className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 id="score-heading" className="text-sm font-medium">
          Fit for this search
        </h2>
        <ConfidenceBadge label={scoring.label} score={scoring.score} />
      </div>
      <ul className="space-y-1.5 text-sm">
        {scoring.lines.map((line) => (
          <li key={line.signal + line.label} className="flex items-start justify-between gap-3">
            <span className={cn(line.points === 0 && "text-muted-foreground", line.points < 0 && "text-destructive")}>
              {line.evidenceIds[0] ? (
                <a href={`#evidence-${line.evidenceIds[0]}`} className="hover:underline">
                  {line.label}
                </a>
              ) : (
                line.label
              )}
            </span>
            <span className={cn("shrink-0 tabular-nums", line.points === 0 && "text-muted-foreground", line.points < 0 && "text-destructive")}>
              {line.max > 0 ? `${line.points}/${line.max}` : line.points}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Found in {scoring.independentSourceTypes} kind{scoring.independentSourceTypes === 1 ? "" : "s"} of source.{" "}
        <Link href="/scoring" className="underline-offset-2 hover:underline">
          How scoring works
        </Link>
      </p>
    </section>
  );
}
