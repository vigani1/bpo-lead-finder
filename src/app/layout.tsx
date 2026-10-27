import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Call Center Lead Finder", template: "%s | Call Center Lead Finder" },
  description: "Find offshore call centers running US insurance campaigns, with the evidence behind every match.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
