import { cn } from "@/lib/utils";

/** The band under the header (daylight in light mode, night navy in dark): full width, content aligned to the page column. */
export function PageBand({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-band text-band-foreground">
      <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>
    </div>
  );
}
