"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EVIDENCE_AGE_OPTIONS } from "@/config/scoring";
import type { ResultsQueryInput } from "@/features/searches/schemas";

interface Props {
  query: ResultsQueryInput;
  onChange: (next: Partial<ResultsQueryInput>) => void;
  shown: number;
  total: number;
  busy: boolean;
}

/** Results filters. Every value lives in the URL: shareable, survives refresh, no login needed. */
export function ResultsFilters({ query, onChange, shown, total, busy }: Props) {
  const [text, setText] = useState(query.q ?? "");

  // Debounce typing so each keystroke doesn't refetch.
  useEffect(() => {
    if ((query.q ?? "") === text) return;
    const timer = setTimeout(() => onChange({ q: text || undefined }), 300);
    return () => clearTimeout(timer);
  }, [text, query.q, onChange]);

  const flag = (key: "campaignConfirmed" | "hasContact" | "hasWebsite", label: string, help: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle variant="outline" size="sm" pressed={query[key] === "true"} onPressedChange={(pressed) => onChange({ [key]: pressed ? "true" : undefined })}>
          {label}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{help}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={query.maxAge ?? "any"} onValueChange={(v) => onChange({ maxAge: v === "any" ? undefined : v })}>
          <SelectTrigger size="sm" aria-label="Evidence age" className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Evidence of any age</SelectItem>
            {EVIDENCE_AGE_OPTIONS.map((days) => (
              <SelectItem key={days} value={String(days)}>
                Evidence from the last {days} days
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={query.minConfidence ?? "all"} onValueChange={(v) => onChange({ minConfidence: v === "all" ? undefined : (v as "medium" | "high") })}>
          <SelectTrigger size="sm" aria-label="Minimum confidence" className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any confidence</SelectItem>
            <SelectItem value="medium">Medium and high</SelectItem>
            <SelectItem value="high">High only</SelectItem>
          </SelectContent>
        </Select>

        {flag("campaignConfirmed", "Campaign confirmed", "Own website or a job ad shows this campaign")}
        {flag("hasContact", "Has phone or email", "A published business phone number or email")}
        {flag("hasWebsite", "Has website", "The center has its own website")}

        <Select value={query.sort ?? "score"} onValueChange={(v) => onChange({ sort: v === "score" ? undefined : (v as "recent" | "sources") })}>
          <SelectTrigger size="sm" aria-label="Sort" className="ml-auto w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Best match first</SelectItem>
            <SelectItem value="recent">Newest evidence first</SelectItem>
            <SelectItem value="sources">Most kinds of source first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filter by name, city or website…"
            className="h-8 pl-8"
            aria-label="Filter results"
          />
        </div>
        <p className="shrink-0 text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {busy ? "Updating…" : shown === total ? `${total} centers` : `${shown} of ${total} centers`}
        </p>
      </div>
    </div>
  );
}
