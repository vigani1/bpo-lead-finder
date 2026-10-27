import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ACCESS_COOKIE, accessToken } from "@/lib/access";
import { AppError } from "@/lib/api/errors";
import { ok, parseJson, route } from "@/lib/api/handler";
import { env } from "@/lib/env";

const schema = z.object({ code: z.string().min(1).max(200) });

/** Compares hashes in constant time, so response timing doesn't leak how much of the code was right. */
function sameCode(a: string, b: string): boolean {
  const hash = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(hash(a), hash(b));
}

/** Checks the shared access code and sets the cookie the proxy looks for. */
export const POST = route(async (request) => {
  const { code } = await parseJson(request, schema);
  const expected = env().ACCESS_CODE;
  if (!expected) return ok({ ok: true });
  if (!sameCode(code.trim(), expected)) throw new AppError("UNAUTHORIZED", "That code isn’t right.");

  const response = ok({ ok: true });
  response.headers.append(
    "set-cookie",
    `${ACCESS_COOKIE}=${await accessToken(expected)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return response;
});
