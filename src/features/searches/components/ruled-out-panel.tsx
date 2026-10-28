"use client";

import { ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import { useId, useState } from "react";
import type { RuledOutGroup } from "@/features/searches/types";
import { labelFor, RULED_OUT_HINTS, RULED_OUT_LABELS, ruledOutDetail } from "@/lib/format";
import { cn } from "@/lib/utils";

/** What was found but didn't count, and why. One line per reason; its examples open on request. */
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
          <ChevronRightIcon aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} />
        </button>
      </h2>
      <ul id={panelId} hidden={!open} className="divide-y border-t">
        {groups.map((g) => (
          <ReasonRow key={g.reason} group={g} />
        ))}
      </ul>
    </section>
  );
}

function ReasonRow({ group }: { group: RuledOutGroup }) {
  const [open, setOpen] = useState(false);
  const examplesId = useId();

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={examplesId}
        className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50 sm:grid-cols-[1rem_14rem_2.5rem_minmax(0,1fr)]"
      >
        <ChevronRightIcon aria-hidden className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="font-medium">{labelFor(RULED_OUT_LABELS, group.reason)}</span>
        <span className="text-right text-muted-foreground tabular-nums">{group.count}</span>
        <span className="hidden truncate text-muted-foreground sm:block">{labelFor(RULED_OUT_HINTS, group.reason)}</span>
      </button>
      <ul id={examplesId} hidden={!open} className="space-y-1.5 pr-4 pb-3 pl-11 text-sm">
        {group.examples.map((e) => (
          <li key={e.url} className="flex min-w-0 items-baseline gap-2">
            {e.url.includes("[removed]") ? (
              <span className="text-muted-foreground">Personal profile, not stored</span>
            ) : (
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                title={e.name ?? e.url}
                className="group/link flex min-w-0 items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <span className="truncate group-hover/link:underline">{e.name ?? new URL(e.url).hostname}</span>
                <ExternalLinkIcon className="size-3 shrink-0 opacity-50" aria-hidden />
              </a>
            )}
            {e.detail && <span className="shrink-0 text-xs text-muted-foreground/70">{ruledOutDetail(e.detail)}</span>}
          </li>
        ))}
        {group.count > group.examples.length && (
          <li className="text-xs text-muted-foreground">
            plus {group.count - group.examples.length} {group.count - group.examples.length === 1 ? "repeat" : "repeats"} of pages above
          </li>
        )}
      </ul>
    </li>
  );
}
