import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SearchForm } from "@/features/searches/components/search-form";
import { StatusDot } from "@/features/searches/components/status-dot";
import { Skeleton } from "@/components/ui/skeleton";
import { getFilterOptions } from "@/features/meta/filter-options";
import { listRecentSearches } from "@/features/searches/server/summary";
import { describeSearch, relativeTime } from "@/lib/format";

export default function HomePage() {
  return (
    <div className="space-y-14">
      <SearchForm
        options={getFilterOptions()}
        intro={
          <header className="max-w-3xl space-y-4">
            <h1 className="text-5xl font-bold text-balance sm:text-6xl">Find the call centers selling US insurance</h1>
            <p className="max-w-2xl leading-relaxed text-pretty text-muted-foreground">
              Pick a campaign and a country. The tool reads job ads, company websites and public business pages, and shows
              each center with its contacts, the quotes that prove what it works on, and how confident the match is.
            </p>
          </header>
        }
      />

      <section aria-labelledby="recent" className="space-y-3">
        <h2 id="recent" className="text-sm font-medium text-muted-foreground">
          Recent searches
        </h2>
        <Suspense fallback={<RecentSkeleton />}>
          <RecentSearches />
        </Suspense>
      </section>
    </div>
  );
}

async function RecentSearches() {
  await connection();
  const searches = await listRecentSearches();
  if (searches.length === 0) {
    return <p className="text-sm text-muted-foreground">No searches yet. Pick a campaign and country above to run the first one.</p>;
  }
  const now = new Date();
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {searches.map((s) => (
        <li key={s.id}>
          <Link href={`/searches/${s.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/60">
            <span className="flex items-center gap-3">
              <StatusDot status={s.status} />
              <span>{describeSearch(s)}</span>
            </span>
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
              {s.status === "done" ? `${s.progress.counts.matched} ${s.progress.counts.matched === 1 ? "center" : "centers"}` : s.status}, {relativeTime(s.createdAt, now)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecentSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
