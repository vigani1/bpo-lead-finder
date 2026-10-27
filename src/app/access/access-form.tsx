"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api-client";

/** `next` is already validated on the server (see page.tsx). */
export function AccessForm({ next }: { next: string }) {
  // A full page load, not router.replace(): the router may still hold the earlier
  // "redirect to /access" for this page, and a fresh load starts with an empty query cache.
  // react-doctor-disable-next-line react-doctor/query-mutation-missing-invalidation
  const submit = useMutation({
    mutationFn: (code: string) => apiFetch("/api/access", { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: () => window.location.assign(next),
  });

  return (
    <form className="space-y-3" action={(formData) => submit.mutate(String(formData.get("code") ?? ""))}>
      <Input name="code" type="password" required autoFocus aria-label="Access code" placeholder="Access code" />
      {submit.error && <p className="text-sm text-destructive">{submit.error instanceof ApiError ? submit.error.message : "Something went wrong."}</p>}
      <Button type="submit" disabled={submit.isPending} className="w-full">
        Continue
      </Button>
    </form>
  );
}
