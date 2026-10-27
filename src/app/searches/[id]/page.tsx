import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SearchView } from "@/features/searches/components/search-view";
import { Skeleton } from "@/components/ui/skeleton";
import { AppError } from "@/lib/api/errors";
import { searchKeys } from "@/features/searches/keys";
import { idParamSchema, pickResultsQueryInput, resultsQuerySchema } from "@/features/searches/schemas";
import { getSearchView } from "@/features/searches/server/search-view";
import { getServerQueryClient } from "@/lib/server-query-client";

export const metadata: Metadata = { title: "Search results" };

export default function SearchPage({ params, searchParams }: PageProps<"/searches/[id]">) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchData params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** Loads the first view on the server and hands it to React Query, so the page paints with data. */
async function SearchData({ params, searchParams }: Pick<PageProps<"/searches/[id]">, "params" | "searchParams">) {
  // Always fresh data from the database: render at request time.
  await connection();
  const parsedId = idParamSchema.safeParse(await params);
  if (!parsedId.success) notFound();
  const id = parsedId.data.id;

  const input = pickResultsQueryInput(await searchParams);
  const queryClient = getServerQueryClient();
  try {
    const view = await getSearchView(id, resultsQuerySchema.parse(input));
    queryClient.setQueryData(searchKeys.view(id, input), view);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* SearchView reads the filters from the URL. */}
      <Suspense fallback={<SearchSkeleton />}>
        <SearchView id={id} />
      </Suspense>
    </HydrationBoundary>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-6 pt-10">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
