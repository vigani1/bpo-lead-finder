import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken } from "@/lib/access";

/**
 * Optional access gate for a public demo: when ACCESS_CODE is set, every page
 * and API call needs the cookie set on /access. Protects the search and AI
 * budget from strangers. Not a user system: one shared code.
 */
export async function proxy(request: NextRequest) {
  const code = process.env.ACCESS_CODE?.trim();
  if (!code) return NextResponse.next();

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie && cookie === (await accessToken(code))) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Enter the access code to use the app." } },
      { status: 401 },
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = "/access";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the access page itself, its API route and static files.
  matcher: ["/((?!access(?:/|$)|api/access(?:/|$)|_next/static|_next/image|favicon.ico$).*)"],
};
