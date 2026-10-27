"use client";

import { ArrowLeftIcon, DownloadIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DEPTH_PRESETS } from "@/config/limits";
import { coverageFor } from "@/features/meta/coverage";
import { toSearchParams, useSearchView, useStartSearch } from "@/features/searches/hooks";
import { pickResultsQueryInput, type ResultsQueryInput } from "@/features/searches/schemas";
import { friendlyErrorMessage } from "@/lib/api-client";
import { describeSearch, relativeTime } from "@/lib/format";
import { ResultsFilters } from "./results-filters";
import { ResultsTable } from "./results-table";
import { RuledOutPanel } from "./ruled-out-panel";
import { SearchProgressBar, SearchStats } from "./search-progress";

export function SearchView({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = useMemo(() => pickResultsQueryInput(Object.fromEntries(params)), [params]);
  const { data, error, isFetching } = useSearchView(id, query);
  const refresh = useStartSearch();

  const setQuery = useCallback(
    (next: Partial<ResultsQueryInput>) => {
      const merged = toSearchParams({ ...query, ...next });
      router.replace(`${pathname}${merged.size ? `?${merged}` : ""}`, { scroll: false });
    },
    [pathname, query, router],
  );

  if (!data) {
    return (
      <Alert variant="destructive" className="mt-10">
        <AlertTitle>Couldn&apos;t load this search</AlertTitle>
        <AlertDescription>{friendlyErrorMessage(error)}</AlertDescription>
      </Alert>
    );
  }

  const { search, results, totalResults, ruledOut } = data;
  const running = search.status === "queued" || search.status === "running";
  const coverage = coverageFor(search.country, search.campaign);
  const exportHref = `/api/searches/${id}/export?${toSearchParams(query)}`;

  return (
    <div className="space-y-8 pt-8">
      <div className="space-y-5">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> New search
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-balance sm:text-5xl">{describeSearch(search)}</h1>
            <p className="text-sm text-muted-foreground">
              {DEPTH_PRESETS[search.depth].label} search started {relativeTime(search.createdAt)}.{" "}
              {coverage.coverage && coverage.coverage !== "strong" && coverage.hint}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={running || refresh.isPending}
              onClick={() => refresh.mutate({ campaign: search.campaign, country: search.country, market: search.market, depth: search.depth, refresh: true })}
            >
              <RefreshCwIcon className={refresh.isPending ? "animate-spin" : undefined} /> Search again live
            </Button>
            <Button variant="outline" asChild>
              <a href={exportHref} download>
                <DownloadIcon /> Export CSV
              </a>
            </Button>
          </div>
        </div>
      </div>

      {running && <SearchProgressBar search={search} />}

      {search.status === "failed" && (
        <Alert variant="destructive">
          <AlertTitle>The search stopped</AlertTitle>
          <AlertDescription>{search.error ?? "Something went wrong while searching."} Saved results below are still valid.</AlertDescription>
        </Alert>
      )}

      {search.progress.sourceErrors.length > 0 && search.status !== "failed" && (
        <Alert>
          <AlertTitle>Some lookups didn&apos;t work</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {[...new Set(search.progress.sourceErrors.map((e) => e.message))].slice(0, 4).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <ResultsFilters query={query} onChange={setQuery} shown={results.length} total={totalResults} busy={isFetching && !running} />

      <ResultsTable rows={results} searchId={id} campaign={search.campaign} running={running} totalResults={totalResults} query={query} />

      <RuledOutPanel groups={ruledOut} />

      {!running && <SearchStats search={search} />}
    </div>
  );
}
