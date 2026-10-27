import { CAMPAIGNS } from "@/config/campaigns";
import { countryLabel } from "@/config/countries";
import { parseParams, parseQuery, route } from "@/lib/api/handler";
import { idParamSchema, resultsQuerySchema } from "@/features/searches/schemas";
import { getSearchView } from "@/features/searches/server/search-view";

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join("; ") : value == null ? "" : String(value);
  // Quote everything; neutralise spreadsheet formulas in scraped text.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV of the results, with the same filters as the table. */
export const GET = route<RouteContext<"/api/searches/[id]/export">>(async (request, context) => {
  const { id } = parseParams(await context.params, idParamSchema);
  const view = await getSearchView(id, parseQuery(request, resultsQuerySchema));

  const header = ["Name", "Confidence", "Score", "Country", "City", "Campaigns", "Phones", "Emails", "Website", "Social", "Sources", "Last seen", "Red flags", "Why"];
  const lines = view.results.map((r) =>
    [
      r.name,
      r.label,
      r.score,
      countryLabel(r.country),
      r.city,
      r.campaigns.map((c) => CAMPAIGNS[c].label),
      r.phones,
      r.emails,
      r.websiteUrl,
      r.socialLinks.map((s) => s.url),
      r.sourceTypes,
      r.lastSeenAt.slice(0, 10),
      r.redFlags,
      r.topReasons,
    ]
      .map(csvCell)
      .join(","),
  );
  const csv = [header.map(csvCell).join(","), ...lines].join("\n");
  const filename = `call-centers-${view.search.country}-${view.search.campaign}-${view.search.createdAt.slice(0, 10)}.csv`;
  return new Response(`﻿${csv}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` },
  });
});
