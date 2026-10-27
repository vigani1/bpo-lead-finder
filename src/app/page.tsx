import { SearchForm } from "@/features/searches/components/search-form";
import { getFilterOptions } from "@/features/meta/filter-options";

export default function HomePage() {
  return (
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
  );
}
