import type { Metadata } from "next";
import { Archivo, Source_Serif_4 } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "./providers";
import "./globals.css";

// Archivo's width axis gives condensed headlines and normal-width text from one family.
const sans = Archivo({ variable: "--font-sans", subsets: ["latin"], axes: ["wdth"] });
const evidence = Source_Serif_4({ variable: "--font-evidence", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Call Center Lead Finder", template: "%s | Call Center Lead Finder" },
  description: "Find offshore call centers running US insurance campaigns, with the evidence behind every match.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${evidence.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
