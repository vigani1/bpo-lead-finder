import type { ruledOut } from "@/lib/db/schema";
import type { RuledOutGroup } from "../types";

type RuledOutRow = typeof ruledOut.$inferSelect;

/** Groups ruled-out pages by reason, biggest group first, with a few distinct examples each. */
export function groupRuledOut(rows: RuledOutRow[], examplesPerGroup = 8): RuledOutGroup[] {
  const groups = new Map<string, RuledOutGroup>();
  for (const r of rows) {
    const group = groups.get(r.reason) ?? { reason: r.reason, count: 0, examples: [] };
    group.count++;
    if (group.examples.length < examplesPerGroup && !group.examples.some((e) => e.url === r.url)) {
      group.examples.push({ url: r.url, name: r.name, detail: r.detail });
    }
    groups.set(r.reason, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}
