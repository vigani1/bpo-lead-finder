import type { Metadata } from "next";
import { PageBand } from "@/components/page-band";
import { CONFIDENCE_THRESHOLDS, PENALTY_POINTS, RECENCY, SIGNAL_POINTS } from "@/config/scoring";

export const metadata: Metadata = { title: "How scoring works" };

/** Only the strongest of these three counts. */
const PROOF: { key: keyof typeof SIGNAL_POINTS; label: string; why: string }[] = [
  { key: "campaignFromJobAd", label: "A job ad names them for the campaign", why: "An ad for an FE closer or Medicare verifier proves the campaign is running now." },
  { key: "campaignFromOwnSite", label: "Their own website offers the campaign", why: "The company says it in its own words, on a service page." },
  {
    key: "campaignMention",
    label: "The campaign is only mentioned",
    why: "A job-listing page naming many employers, a blog article, a social post or a gig. “Top 20 call centers” posts don’t count for the site that wrote them.",
  },
];

const SIGNALS: { key: keyof typeof SIGNAL_POINTS; label: string; why: string; bonus?: boolean }[] = [
  { key: "countryConfirmed", label: "In the requested country", why: "Two kinds of signal agree (phone prefix, local job board, city, domain ending). One kind earns less." },
  { key: "servesMarket", label: "Serves the requested market", why: "Only counted for Spanish or bilingual searches." },
  { key: "independentSources", label: "Found in two or more kinds of source", why: "A website and a job ad agreeing is stronger than either alone." },
  { key: "revenueRole", label: "Sales, transfers or appointment setting", why: "Customer-service-only work is a different kind of partner." },
  { key: "hasContact", label: "Has a business contact", why: "A published phone, email or website." },
  { key: "complianceLanguage", label: "Compliance language", why: "TCPA, DNC scrubbing, consent proof, call recordings: what buyers ask about." },
  { key: "severalJobAds", label: "Several distinct job ads", why: "Reposts of the same ad count once.", bonus: true },
  { key: "corroborated", label: "Campaign shown by two kinds of source", why: "For example a job ad and the website agreeing.", bonus: true },
  { key: "usHours", label: "Works US hours", why: "Night-shift ads suggest US-facing campaigns.", bonus: true },
];

const PENALTIES: { key: keyof typeof PENALTY_POINTS; label: string }[] = [
  { key: "redFlag", label: "Each red flag, like “$0 plan” or “free cash card” bait, or high-risk campaigns" },
  { key: "resoldTransfers", label: "Advertises shared, resold or aged leads (“never resold” doesn’t count)" },
  { key: "vendorListingOnly", label: "The only evidence is a freelance gig" },
];

export default function ScoringPage() {
  return (
    <article className="space-y-10">
      <PageBand className="space-y-4 pt-12 pb-12">
        <h1 className="display text-5xl sm:text-6xl">How scoring works</h1>
        <p className="max-w-2xl leading-relaxed text-band-muted">
          The AI only reads pages and pulls out facts, each with a word-for-word quote. Plain code then checks every quote is
          really on the page and adds up the points below. The score is the share of applicable points a center earns, so a
          search for “any country” isn&apos;t marked down for location.
        </p>
      </PageBand>

      <div className="max-w-3xl space-y-10">

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Proof of the campaign</h2>
        <p className="text-sm text-muted-foreground">Only the strongest piece counts, so a center needs a job ad or its own website, not both.</p>
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {PROOF.map((s) => (
              <tr key={s.key} className="align-top">
                <td className="py-2.5 pr-4">
                  <div className="font-medium">{s.label}</div>
                  <div className="text-muted-foreground">{s.why}</div>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap tabular-nums">+{SIGNAL_POINTS[s.key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Other signals</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {SIGNALS.map((s) => (
              <tr key={s.key} className="align-top">
                <td className="py-2.5 pr-4">
                  <div className="font-medium">{s.label}</div>
                  <div className="text-muted-foreground">{s.why}</div>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap tabular-nums">
                  +{SIGNAL_POINTS[s.key]}
                  {s.bonus && <span className="block text-xs text-muted-foreground">bonus</span>}
                </td>
              </tr>
            ))}
            {PENALTIES.map((p) => (
              <tr key={p.key} className="align-top text-destructive">
                <td className="py-2.5 pr-4">{p.label}</td>
                <td className="py-2.5 text-right tabular-nums">{PENALTY_POINTS[p.key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Confidence</h2>
        <ul className="space-y-1 leading-relaxed">
          <li>
            <span className="font-medium text-confidence-high">High</span>: score {CONFIDENCE_THRESHOLDS.high.minScore} or more, and the proof is a
            job ad or their own website (a mention alone is never High).
          </li>
          <li>
            <span className="font-medium text-confidence-medium">Medium</span>: score {CONFIDENCE_THRESHOLDS.medium.minScore} or more.
          </li>
          <li>
            <span className="font-medium text-confidence-low">Low</span>: everything else, and any center not shown to be in the requested country.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          The labels are a reading aid, not a measured probability. How often each label is right is tracked separately
          from reviewer feedback.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Old evidence</h2>
        <p className="leading-relaxed">
          Evidence up to {RECENCY.fullWeightDays} days old counts fully, up to {RECENCY.halfWeightDays} days counts half, and older
          evidence counts nothing. Reposts of a job ad (same wording) count as one ad. On
          a results page you can also hide older evidence entirely; scores recalculate instantly.
        </p>
      </section>
      </div>
    </article>
  );
}
