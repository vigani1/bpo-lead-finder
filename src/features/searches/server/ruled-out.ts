import type { ruledOut } from "@/lib/db/schema";
import type { RuledOutGroup } from "../types";

type RuledOutRow = typeof ruledOut.$inferSelect;

/**
 * Groups ruled-out pages by reason, biggest group first, listing every distinct page.
 * The same job ad is often posted at several addresses, so a page shown the same way (same
 * title, or same host when there is no title) with the same detail is listed once; it still counts.
 */
export function groupRuledOut(rows: RuledOutRow[]): RuledOutGroup[] {
  const groups = new Map<string, RuledOutGroup>();
  for (const r of rows) {
    const group = groups.get(r.reason) ?? { reason: r.reason, count: 0, examples: [] };
    group.count++;
    const repeat = group.examples.some((e) => e.url === r.url || (shownAs(e) === shownAs(r) && e.detail === r.detail));
    if (!repeat) {
      group.examples.push({ url: r.url, name: r.name, detail: r.detail });
    }
    groups.set(r.reason, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

/** What the list shows for a page: its title, or its host when there is none. */
function shownAs(page: { url: string; name: string | null }): string {
  return page.name ?? new URL(page.url).hostname;
}
