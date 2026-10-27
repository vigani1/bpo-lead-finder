import { CAMPAIGNS, CAMPAIGN_IDS } from "@/config/campaigns";
import { MARKETS } from "@/config/markets";
import { COMPLIANCE_KEYWORDS, US_HOURS_KEYWORDS } from "@/config/signals";
import { cn } from "@/lib/utils";

const ALL_TERMS = [
  ...CAMPAIGN_IDS.flatMap((id) => CAMPAIGNS[id].keywords),
  ...MARKETS.spanish.keywords,
  ...MARKETS.bilingual.keywords,
  ...COMPLIANCE_KEYWORDS,
  ...US_HOURS_KEYWORDS,
].sort((a, b) => b.length - a.length);

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whole words only, so "fe campaign" isn't marked inside "life campaigns".
const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(${ALL_TERMS.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "giu");

/** A verbatim excerpt, with the words that made it count marked like a highlighter. */
export function HighlightedQuote({ quote, className }: { quote: string; className?: string }) {
  const parts = quote.split(PATTERN);
  return (
    <blockquote className={cn("evidence-quote text-foreground/90", className)}>
      “
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}
      ”
    </blockquote>
  );
}
