import { HighlightedQuote } from "@/components/highlighted-quote";
import { describeClassifier } from "@/lib/ai/classifier-id";
import { redFlagQuoteVerdict } from "@/lib/claim-checks";
import { ROLE_LABELS, type CampaignId, type CampaignRole } from "@/config/campaigns";
import { countryLabel } from "@/config/countries";
import { MARKETS, type MarketId } from "@/config/markets";
import type { EvidenceView } from "@/features/centers/types";
import { campaignLabel, docKindLabel, labelFor, MERGE_LABELS, relativeTime, SOURCE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

function heading(e: EvidenceView): string {
  switch (e.kind) {
    case "hiring":
      return `Hiring for ${campaignLabel(e.value).toLowerCase()}`;
    case "campaign":
      return `Works on ${campaignLabel(e.value).toLowerCase()}`;
    case "market":
      return `Serves the ${MARKETS[e.value as MarketId]?.label ?? e.value} market`;
    case "country":
      return `Located in ${countryLabel(e.value)}`;
    case "compliance":
      return "Compliance language";
    case "red_flag":
      return `Red flag: ${e.value.replace(/_/g, " ")}`;
    case "us_hours":
      return "Works US hours";
    case "entity":
      return "Company named here";
    case "listing":
      return `Listed on ${docKindLabel(e.value)}`;
    default:
      return e.kind;
  }
}

/** Groups evidence by what it proves: campaigns first, then location, market, trust signals. */
const ORDER = ["hiring", "campaign", "entity", "red_flag", "market", "country", "compliance", "us_hours", "listing"];

export function EvidenceList({ evidence, highlightCampaign }: { evidence: EvidenceView[]; highlightCampaign?: CampaignId }) {
  // Red flags saved under older rules are re-checked, the same way the score does ("never resold" isn't one).
  const shown = evidence.filter((e) => e.kind !== "red_flag" || redFlagQuoteVerdict(e.value, e.quote) === "ok");
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">No evidence recorded.</p>;
  const sorted = [...shown].sort((a, b) => {
    const kind = ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind);
    if (kind !== 0) return kind;
    const requested = Number(b.value === highlightCampaign) - Number(a.value === highlightCampaign);
    return requested || b.seenAt.localeCompare(a.seenAt);
  });
  const now = new Date();

  return (
    <ol className="space-y-5">
      {sorted.map((e) => {
        const host = new URL(e.sourceUrl).hostname.replace(/^www\./, "");
        return (
          <li key={e.id} id={`evidence-${e.id}`} className={cn("border-l-2 pl-4", e.kind === "red_flag" ? "border-destructive" : e.value === highlightCampaign ? "border-highlight" : "border-border")}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="text-sm font-medium">
                {heading(e)}
                {e.campaignRole && e.campaignRole !== "unknown" && (
                  <span className="font-normal text-muted-foreground">, {ROLE_LABELS[e.campaignRole as CampaignRole]?.toLowerCase()}</span>
                )}
              </h3>
              <span className="text-xs text-muted-foreground">{relativeTime(e.postedAt ?? e.seenAt, now)}</span>
            </div>
            <HighlightedQuote quote={e.quote} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">
              <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-foreground/80 underline-offset-2 hover:underline">
                {host}
              </a>{" "}
              ({labelFor(SOURCE_LABELS, e.source)}), {labelFor(MERGE_LABELS, e.mergeRule)}, read by {describeClassifier(e.classifier)}
              {e.matchType === "normalized" && ", quote matched after normalizing spacing"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
