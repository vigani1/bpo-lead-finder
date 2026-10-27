import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ContactList } from "@/features/centers/components/contact-list";
import { EvidenceList } from "@/features/centers/components/evidence-list";
import { ScoreBreakdown } from "@/features/centers/components/score-breakdown";
import { PageBand } from "@/components/page-band";
import { Skeleton } from "@/components/ui/skeleton";
import { AppError } from "@/lib/api/errors";
import { ENTITY_LABELS, type EntityType } from "@/lib/ai/schema";
import { describeSearch, formatLocation, labelFor, relativeTime, SIGNAL_TYPE_LABELS } from "@/lib/format";
import { getCenterView } from "@/features/centers/server/center-view";
import { idParamSchema, resultsQuerySchema } from "@/features/searches/schemas";

export const metadata: Metadata = { title: "Center" };

export default function CenterPage({ params, searchParams }: PageProps<"/centers/[id]">) {
  return (
    <Suspense fallback={<CenterSkeleton />}>
      <CenterDetails params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** `?searchId=&maxAge=` score the center for the search the user came from; bad values are ignored. */
function scoringContext(sp: Awaited<PageProps<"/centers/[id]">["searchParams"]>) {
  const searchId = idParamSchema.shape.id.safeParse(sp.searchId);
  const maxAge = resultsQuerySchema.shape.maxAge.safeParse(typeof sp.maxAge === "string" ? sp.maxAge : undefined);
  return { searchId: searchId.success ? searchId.data : undefined, maxAge: maxAge.success ? maxAge.data : null };
}

async function CenterDetails({ params, searchParams }: Pick<PageProps<"/centers/[id]">, "params" | "searchParams">) {
  // Always fresh data from the database: render at request time.
  await connection();
  const parsed = idParamSchema.safeParse(await params);
  if (!parsed.success) notFound();
  let view;
  try {
    view = await getCenterView(parsed.data.id, scoringContext(await searchParams));
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { center, evidence, scoring } = view;
  const now = new Date();
  const countrySignalKinds = [...new Set(center.countrySignals.filter((s) => s.country === center.country).map((s) => labelFor(SIGNAL_TYPE_LABELS, s.type)))];

  return (
    <div className="space-y-10">
      <PageBand className="space-y-5 pt-8 pb-10">
        <Link
          href={scoring ? `/searches/${scoring.searchId}` : "/"}
          className="inline-flex items-center gap-1 text-sm text-band-muted hover:text-band-foreground"
        >
          <ArrowLeftIcon className="size-4" /> {scoring ? `Back to ${describeSearch(scoring, { midSentence: true })}` : "New search"}
        </Link>
        <div className="space-y-3">
          <h1 className="display text-4xl text-balance sm:text-6xl">{center.name}</h1>
          <p className="text-band-muted">
            {ENTITY_LABELS[center.entityType as EntityType] ?? center.entityType}
            {(center.city || center.country) && ` in ${formatLocation(center.city, center.country)}`}
            {center.country && !center.countryConfirmed && " (likely)"}
          </p>
          {center.summary && <p className="max-w-2xl leading-relaxed">{center.summary}</p>}
        </div>
      </PageBand>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10">
          <section aria-labelledby="evidence-heading" className="space-y-3">
            <h2 id="evidence-heading" className="text-lg font-medium">
              Evidence
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Every claim below is a word-for-word excerpt that was checked against the page it came from.
            </p>
            <EvidenceList evidence={evidence} highlightCampaign={scoring?.campaign} />
          </section>
        </div>

        <aside className="space-y-8">
          {scoring && <ScoreBreakdown scoring={scoring} />}

          <ContactList center={center} />

          <section className="space-y-1 text-sm text-muted-foreground">
            <p>
              Location from: {countrySignalKinds.length ? countrySignalKinds.join(", ") : "no signals yet"}.
            </p>
            <p>
              First seen {relativeTime(center.firstSeenAt, now)}, last checked {relativeTime(center.lastCheckedAt, now)}.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function CenterSkeleton() {
  return (
    <div className="space-y-6 pt-10">
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-5 w-1/3" />
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
