import { ArrowRightIcon, CheckIcon, CircleDashedIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { CenterView } from "@/features/centers/types";
import type { ScoreLine } from "@/lib/scoring/score";
import { cn } from "@/lib/utils";

type LineKind = "found" | "penalty" | "missing";

/** Every applicable signal with points earned out of available: no score without its reasons. */
export function ScoreBreakdown({ scoring }: { scoring: NonNullable<CenterView["scoring"]> }) {
  // Split by outcome so signals that weren't found read as their own list, not as notes on the ones above.
  const found = scoring.lines.filter((l) => l.points > 0);
  const penalties = scoring.lines.filter((l) => l.points < 0);
  const missing = scoring.lines.filter((l) => l.points === 0 && l.max > 0);

  return (
    <section aria-labelledby="score-heading" className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 id="score-heading" className="text-sm font-medium">
            Fit for this search
          </h2>
          <ConfidenceBadge label={scoring.label} score={scoring.score} />
        </div>
        {scoring.labelReason && <p className="text-sm text-muted-foreground">{scoring.labelReason}.</p>}
      </div>
      <LineGroup title="Found" lines={found} kind="found" />
      <LineGroup title="Taken off" lines={penalties} kind="penalty" />
      <LineGroup title="Not found" lines={missing} kind="missing" />
      <div className="space-y-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Score {scoring.score} = {scoring.earned} of {scoring.possible} possible points
          {scoring.earned > scoring.possible ? ", capped at 100" : scoring.earned < 0 ? ", floored at 0" : ""} (bonuses add points but aren’t counted in
          the {scoring.possible}).
        </p>
        <Link href="/scoring" className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4 hover:text-foreground/80">
          How scoring works <ArrowRightIcon aria-hidden className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}

const ICONS: Record<LineKind, { icon: typeof CheckIcon; className: string }> = {
  found: { icon: CheckIcon, className: "text-confidence-high" },
  penalty: { icon: TriangleAlertIcon, className: "text-destructive" },
  missing: { icon: CircleDashedIcon, className: "text-muted-foreground/60" },
};

function LineGroup({ title, lines, kind }: { title: string; lines: ScoreLine[]; kind: LineKind }) {
  if (lines.length === 0) return null;
  const { icon: Icon, className: iconClass } = ICONS[kind];
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="space-y-1.5 text-sm">
        {lines.map((line) => (
          <li key={line.signal + line.label} className="flex items-start gap-2">
            <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
            <span className={cn("min-w-0 flex-1", kind === "missing" && "text-muted-foreground", kind === "penalty" && "text-destructive")}>
              {line.evidenceIds[0] ? (
                <a href={`#evidence-${line.evidenceIds[0]}`} className="hover:underline">
                  {line.label}
                </a>
              ) : (
                line.label
              )}
              {line.bonus && <span className="ml-1.5 rounded-sm bg-muted px-1 py-px text-xs text-muted-foreground">bonus</span>}
            </span>
            <Points line={line} kind={kind} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "10/30" with a small bar for signals, "−20" for penalties. */
function Points({ line, kind }: { line: ScoreLine; kind: LineKind }) {
  if (kind === "penalty") return <span className="shrink-0 text-destructive tabular-nums">−{Math.abs(line.points)}</span>;
  return (
    <span className={cn("flex shrink-0 items-center gap-2 tabular-nums", kind === "missing" && "text-muted-foreground")}>
      {kind === "found" && (
        <span aria-hidden className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-confidence-high" style={{ width: `${(line.points / line.max) * 100}%` }} />
        </span>
      )}
      {line.points}/{line.max}
    </span>
  );
}
