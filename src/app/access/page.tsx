import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessForm } from "./access-form";

export const metadata: Metadata = { title: "Access code" };

/** Same-site paths only, never an open redirect ("//x" and "/\x" both leave the site). */
function safeNextPath(next: string | string[] | undefined): string {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : "/";
}

export default function AccessPage({ searchParams }: PageProps<"/access">) {
  return (
    <div className="mx-auto max-w-sm space-y-4 pt-24">
      <h1 className="display text-4xl">Enter the access code</h1>
      <p className="text-sm text-muted-foreground">This demo is shared with a code so search credits aren’t used up by strangers.</p>
      <Suspense>
        <AccessFormWithRedirect searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** The `?next=` page is checked here on the server; the form only receives a safe path. */
async function AccessFormWithRedirect({ searchParams }: Pick<PageProps<"/access">, "searchParams">) {
  const { next } = await searchParams;
  return <AccessForm next={safeNextPath(next)} />;
}
