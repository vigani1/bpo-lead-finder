import type { SearchStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const STYLES: Record<SearchStatus, string> = {
  queued: "bg-confidence-low",
  running: "bg-highlight animate-pulse",
  done: "bg-confidence-high",
  failed: "bg-destructive",
};

export function StatusDot({ status }: { status: SearchStatus }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", STYLES[status])} />;
}
