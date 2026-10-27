import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="bg-band text-band-foreground">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" translate="no" className="flex items-center gap-2.5 font-semibold whitespace-nowrap">
          <span aria-hidden className="size-2.5 rounded-full bg-lamp shadow-lamp" />
          Call Center Lead Finder
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/scoring" className="rounded-md px-2.5 py-1.5 text-band-muted hover:bg-band-foreground/10 hover:text-band-foreground">
            <span className="sm:hidden">Scoring</span>
            <span className="hidden sm:inline">How scoring works</span>
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
