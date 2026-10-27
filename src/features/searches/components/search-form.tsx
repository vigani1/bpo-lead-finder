"use client";

import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CampaignId } from "@/config/campaigns";
import type { CountryFilter } from "@/config/countries";
import type { SearchDepth } from "@/config/limits";
import type { MarketFilter } from "@/config/markets";
import { coverageFor } from "@/features/meta/coverage";
import type { FilterOptions } from "@/features/meta/filter-options";
import { useStartSearch, useUsage } from "@/features/searches/hooks";
import { cn } from "@/lib/utils";
import { PageBand } from "@/components/page-band";

/** A label above its control; `labelId` names the control for screen readers. */
function Field({ label, labelId, htmlFor, children, className }: { label: string; labelId: string; htmlFor?: string; children: ReactNode; className?: string }) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className={cn("space-y-2", className)}>
      <Label id={labelId} htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** One choice out of a few, all visible at once. */
function Segmented<T extends string>({
  labelledBy,
  value,
  onChange,
  options,
  className,
}: {
  labelledBy: string;
  value: T;
  onChange: (value: T) => void;
  options: { id: string; label: string; title?: string }[];
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-labelledby={labelledBy}
      className={cn("grid w-full rounded-lg bg-muted p-1", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.id}
          value={o.id}
          title={o.title}
          className="h-9 text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:data-[state=on]:bg-input"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function FieldSelect<T extends string>({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: T;
  onChange: (value: T) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger id={id} className="w-full bg-card data-[size=default]:h-11">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const COVERAGE_TONE: Record<string, string> = {
  strong: "bg-confidence-high",
  workable: "bg-confidence-medium",
  weak: "bg-confidence-low",
  none: "bg-destructive",
};

/** The home page hero and search panel. `intro` is the headline shown above the panel. */
export function SearchForm({ options, intro }: { options: FilterOptions; intro: ReactNode }) {
  const [campaign, setCampaign] = useState<CampaignId>("final_expense");
  const [country, setCountry] = useState<CountryFilter>("pk");
  const [market, setMarket] = useState<MarketFilter>("any");
  const [depth, setDepth] = useState<SearchDepth>("quick");
  const start = useStartSearch();
  const usage = useUsage();
  const coverage = coverageFor(country, campaign);
  const id = useId();

  return (
    <form action={() => start.mutate({ campaign, country, market, depth })}>
      <PageBand className="pt-12 pb-32 sm:pt-16">{intro}</PageBand>

      <div className="relative -mt-20 overflow-hidden rounded-xl border bg-card shadow-xl shadow-foreground/10">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[16rem_minmax(0,1fr)_16rem]">
          <Field label="Where the call floor is" labelId={`${id}-country-label`} htmlFor={`${id}-country`}>
            <FieldSelect id={`${id}-country`} value={country} onChange={setCountry} options={options.countries} />
          </Field>
          <Field label="Campaign" labelId={`${id}-campaign`}>
            <Segmented
              labelledBy={`${id}-campaign`}
              value={campaign}
              onChange={setCampaign}
              options={options.campaigns}
              className="grid-cols-2 sm:grid-cols-4"
            />
          </Field>
          <Field label="Language / market" labelId={`${id}-market-label`} htmlFor={`${id}-market`}>
            <FieldSelect id={`${id}-market`} value={market} onChange={setMarket} options={options.markets} />
          </Field>
        </div>

        <div className="flex flex-col gap-4 border-t bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3">
            <span id={`${id}-depth`} className="text-sm font-medium">
              Depth
            </span>
            <Segmented
              labelledBy={`${id}-depth`}
              value={depth}
              onChange={setDepth}
              options={options.depths.map((d) => ({ id: d.id, label: d.label, title: d.description }))}
              className="w-auto grid-cols-2"
            />
          </div>
          <div className="flex-1 space-y-0.5 text-sm">
            <p className="flex items-center gap-2" aria-live="polite">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", coverage.coverage ? COVERAGE_TONE[coverage.coverage] : "bg-muted-foreground")} />
              {coverage.hint}
            </p>
            <p className="text-muted-foreground tabular-nums">
              {options.depths.find((d) => d.id === depth)?.description}.
              {usage.data && <> {Math.max(0, usage.data.limitPerHour - usage.data.usedThisHour)} of {usage.data.limitPerHour} new searches left this hour.</>}
              {coverage.note && <> {coverage.note}</>}
            </p>
          </div>
          <Button type="submit" size="lg" className="h-11 px-6" disabled={start.isPending}>
            {start.isPending ? <LoaderCircleIcon className="animate-spin" /> : <SearchIcon />}
            Find call centers
          </Button>
        </div>
      </div>
    </form>
  );
}
