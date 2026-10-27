import { cn } from "@/lib/utils";
import type { ConfidenceLabel } from "@/lib/scoring/score";

const BAR_HEIGHTS = ["h-2", "h-2.5", "h-3.5"];

const STYLES: Record<ConfidenceLabel, { label: string; className: string; bars: number }> = {
  high: { label: "High", className: "text-confidence-high", bars: 3 },
  medium: { label: "Medium", className: "text-confidence-medium", bars: 2 },
  low: { label: "Low", className: "text-confidence-low", bars: 1 },
};

/** Confidence as a word plus a 3-bar meter (never color alone), with the score beside it. */
export function ConfidenceBadge({ label, score, className }: { label: ConfidenceLabel; score?: number; className?: string }) {
  const style = STYLES[label];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", style.className, className)}>
      <span aria-hidden className="flex items-end gap-0.5">
        {BAR_HEIGHTS.map((height, i) => (
          <span key={height} className={cn("w-1 rounded-xs bg-current", height, i >= style.bars && "opacity-20")} />
        ))}
      </span>
      {style.label}
      {score !== undefined && <span className="tabular-nums font-normal text-muted-foreground">{score}</span>}
    </span>
  );
}
