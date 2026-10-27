import { useSyncExternalStore } from "react";
import { US_CALL_HOURS } from "@/config/call-hours";

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 5_000);
  return () => clearInterval(timer);
}

/**
 * The current minute, ticking on the client. Returns null during server
 * rendering so clocks never cause a hydration mismatch.
 */
export function useCurrentMinute(): Date | null {
  const minute = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / MINUTE),
    () => null,
  );
  return minute === null ? null : new Date(minute * MINUTE);
}

// Intl formatters are slow to build, so each one is made once per zone.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = formatters.get(key);
  if (!f) formatters.set(key, (f = new Intl.DateTimeFormat("en-US", options)));
  return f;
}

/** Minutes the zone's wall clock is ahead of UTC at `at` (handles daylight saving). */
function utcOffsetMinutes(timeZone: string, at: Date): number {
  const parts = formatter(`parts:${timeZone}`, {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((wall - at.getTime()) / MINUTE);
}

export function formatClock(timeZone: string, at: Date): string {
  return formatter(`clock:${timeZone}`, { timeZone, hour: "numeric", minute: "2-digit" }).format(at);
}

/** "7 PM", or "6:30 PM" for zones with half-hour offsets. */
export function formatTimeOfDay(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(m / 60);
  const minute = m % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour < 12 ? "AM" : "PM"}`;
}

/** Where the US calling window falls on a local clock, and whether it means working nights. */
export function usCallWindowIn(timeZone: string, at: Date) {
  const shift = utcOffsetMinutes(timeZone, at) - utcOffsetMinutes(US_CALL_HOURS.timeZone, at);
  const start = US_CALL_HOURS.startHour * 60 + shift;
  const end = US_CALL_HOURS.endHour * 60 + shift;
  // Night shift: the window covers 2 AM local time on either day.
  const nightShift = [120, 120 + 1440].some((m) => m >= start && m < end);
  return { start: formatTimeOfDay(start), end: formatTimeOfDay(end), nightShift };
}

/** "9 AM to 9 PM", the US window in Eastern time. */
export const US_CALL_HOURS_LABEL = `${formatTimeOfDay(US_CALL_HOURS.startHour * 60)} to ${formatTimeOfDay(US_CALL_HOURS.endHour * 60)}`;

/** True while the US calling window is open on the East Coast. */
export function usLinesOpen(at: Date): boolean {
  const hour = Number(formatter("us-hour", { timeZone: US_CALL_HOURS.timeZone, hourCycle: "h23", hour: "numeric" }).format(at));
  return hour >= US_CALL_HOURS.startHour && hour < US_CALL_HOURS.endHour;
}
