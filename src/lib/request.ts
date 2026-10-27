import "server-only";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/text";

/** Visitor identity for rate limiting: a salted hash of the IP, never the IP itself. */
export function ipHashFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip") || "local";
  return sha256(`${env().IP_HASH_SALT}:${ip}`).slice(0, 32);
}
