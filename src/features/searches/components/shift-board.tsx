"use client";

import { ChevronDownIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { US_CALL_HOURS } from "@/config/call-hours";
import type { CountryFilter } from "@/config/countries";
import type { CountryOption } from "@/features/meta/filter-options";
import { formatClock, US_CALL_HOURS_LABEL, usCallWindowIn, useCurrentMinute, usLinesOpen } from "@/lib/clock";
import { cn } from "@/lib/utils";

const TILE =
  "flex h-auto min-w-0 flex-col items-start justify-start gap-1 rounded-lg border border-band-line px-3 py-2.5 text-left text-band-foreground transition hover:bg-band-foreground/10 hover:text-band-foreground";
const TILE_ON = "border-band-foreground bg-band-foreground text-band hover:bg-band-foreground hover:text-band";

/** Name, local time and shift for one place. */
function TileFace({ name, option, now, linesOpen }: { name: React.ReactNode; option: CountryOption; now: Date | null; linesOpen: boolean }) {
  const shift = now && option.timeZone && option.id !== "any" ? usCallWindowIn(option.timeZone, now) : null;
  const where = option.id === "any" ? "US Eastern" : (option.city ?? option.label);
  return (
    <>
      <span className="flex w-full items-center justify-between gap-2 text-sm font-medium">
        <span className="truncate">{name}</span>
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", linesOpen ? "bg-lamp shadow-lamp" : "bg-current opacity-25")} />
      </span>
      <span className="display text-3xl tabular-nums">{now && option.timeZone ? formatClock(option.timeZone, now) : "--:--"}</span>
      <span className="w-full truncate text-xs font-normal opacity-70">
        {where}
        {shift && `, ${shift.nightShift ? "night" : "day"} shift`}
      </span>
    </>
  );
}

/** The last tile: a list of every untuned country, showing the chosen one's clock. */
function OtherCountryTile({
  others,
  selected,
  onChange,
  now,
  linesOpen,
}: {
  others: CountryOption[];
  selected: CountryOption | undefined;
  onChange: (value: CountryFilter) => void;
  now: Date | null;
  linesOpen: boolean;
}) {
  return (
    <Select value={selected?.id ?? ""} onValueChange={onChange}>
      <SelectTrigger
        aria-label={selected ? `Other country: ${selected.label}` : `Other country, ${others.length} more`}
        className={cn(
          TILE,
          "w-full shadow-none data-placeholder:text-band-foreground data-[size=default]:h-auto dark:bg-transparent dark:hover:bg-band-foreground/10 [&>svg:last-child]:hidden",
          selected && TILE_ON,
        )}
      >
        {selected ? (
          <TileFace
            name={
              <span className="flex items-center gap-1">
                {selected.label} <ChevronDownIcon className="size-3.5 opacity-60" />
              </span>
            }
            option={selected}
            now={now}
            linesOpen={linesOpen}
          />
        ) : (
          <>
            <span className="text-sm font-medium">Other country</span>
            <span className="display flex items-center gap-1 text-3xl">
              {others.length} more <ChevronDownIcon className="size-5 opacity-60" />
            </span>
            <span className="text-xs font-normal opacity-70">Not tuned yet</span>
          </>
        )}
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-80">
        {others.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** When the chosen country's floor takes US calls, in its own local time. */
function shiftSentence(selected: CountryOption | undefined, now: Date, linesOpen: boolean): string {
  if (!selected?.timeZone || selected.id === "any") {
    return `It's ${formatClock(US_CALL_HOURS.timeZone, now)} in New York and US calling hours are ${linesOpen ? "open" : "closed"}. Pick a country to see its shift.`;
  }
  const callWindow = usCallWindowIn(selected.timeZone, now);
  const place = selected.city ?? selected.label;
  return `US calls go out ${US_CALL_HOURS_LABEL} Eastern. In ${place} that's ${callWindow.start} to ${callWindow.end}, so the floor works ${callWindow.nightShift ? "nights" : "days"}.`;
}

/**
 * The country picker, drawn as a wall of local clocks. Offshore floors work US
 * hours, so each clock also says whether that means a day or a night shift.
 * The tuned countries get a clock each; every other country is in the last tile.
 */
export function ShiftBoard({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: CountryOption[];
  value: CountryFilter;
  onChange: (value: CountryFilter) => void;
  labelledBy: string;
}) {
  const now = useCurrentMinute();
  const linesOpen = now !== null && usLinesOpen(now);
  const selected = options.find((o) => o.id === value);
  const otherSelected = selected && !selected.tuned ? selected : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ToggleGroup
          type="single"
          spacing={2}
          value={otherSelected ? "" : value}
          onValueChange={(v) => v && onChange(v as CountryFilter)}
          aria-labelledby={labelledBy}
          className="contents"
        >
          {options
            .filter((o) => o.tuned)
            .map((o) => (
              <ToggleGroupItem key={o.id} value={o.id} aria-label={o.label} className={cn(TILE, "data-[state=on]:border-band-foreground data-[state=on]:bg-band-foreground data-[state=on]:text-band")}>
                <TileFace name={o.id === "any" ? "Anywhere" : (o.shortLabel ?? o.label)} option={o} now={now} linesOpen={linesOpen} />
              </ToggleGroupItem>
            ))}
        </ToggleGroup>
        <OtherCountryTile others={options.filter((o) => !o.tuned)} selected={otherSelected} onChange={onChange} now={now} linesOpen={linesOpen} />
      </div>

      <p className="min-h-5 text-sm text-band-muted">{now && shiftSentence(selected, now, linesOpen)}</p>
    </div>
  );
}
