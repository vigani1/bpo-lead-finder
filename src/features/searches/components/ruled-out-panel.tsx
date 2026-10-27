"use client";

import { ChevronRightIcon } from "lucide-react";
import { useId, useState } from "react";
import type { RuledOutGroup } from "@/features/searches/types";
import { labelFor, RULED_OUT_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

/** What was found but didn't count, and why. Turns a thin result into an explained one. */
export function RuledOutPanel({ groups }: { groups: RuledOutGroup[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  if (total === 0) return null;

  return (
    <section className="rounded-lg border">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
        >
          <span>
            <span className="font-medium">{total} ruled out</span>
            <span className="text-sm text-muted-foreground">
              {" "}
              {groups
                .slice(0, 3)
                .map((g) => `${labelFor(RULED_OUT_LABELS, g.reason)} (${g.count})`)
                .join("; ")}
            </span>
          </span>
          <ChevronRightIcon className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="space-y-4 border-t px-4 py-4">
        {groups.map((g) => (
          <div key={g.reason}>
            <h3 className="text-sm font-medium">
              {labelFor(RULED_OUT_LABELS, g.reason)} <span className="font-normal text-muted-foreground tabular-nums">({g.count})</span>
            </h3>
            <ul className="mt-1 space-y-1 text-sm">
              {g.examples.map((e) => (
                <li key={e.url} className="flex flex-wrap gap-x-2 text-muted-foreground">
                  {e.url.includes("[removed]") ? (
                    <span>Personal profile, not stored</span>
                  ) : (
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-foreground hover:underline">
                      {e.name ?? new URL(e.url).hostname}
                    </a>
                  )}
                  {e.detail && <span>{e.detail}</span>}
                </li>
              ))}
              {g.count > g.examples.length && <li className="text-muted-foreground">and {g.count - g.examples.length} more</li>}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
