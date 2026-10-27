import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { LIMITS } from "@/config/limits";
import { env } from "@/lib/env";

export class FetchBlockedError extends Error {
  constructor(
    readonly reason: "invalid_url" | "private_address" | "too_many_redirects" | "too_large" | "not_html" | "http_error" | "timeout",
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchBlockedError";
  }
}

export function userAgent(): string {
  return `CallCenterLeadFinder/0.1 (+${env().CONTACT_URL})`;
}

/** Short token robots.txt rules are matched against. */
export const ROBOTS_USER_AGENT = "CallCenterLeadFinder";

/**
 * Addresses a public web page can never be on. Node's BlockList also matches
 * IPv4 addresses written in IPv6 form (::ffff:127.0.0.1, ::ffff:7f00:1).
 */
const PRIVATE_RANGES = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 3], // multicast and reserved
] as const) {
  PRIVATE_RANGES.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127], // unspecified and loopback
  ["64:ff9b::", 96], // NAT64: maps to IPv4, including private ranges
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // old site-local
  ["ff00::", 8], // multicast
] as const) {
  PRIVATE_RANGES.addSubnet(network, prefix, "ipv6");
}

function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return true;
  return PRIVATE_RANGES.check(ip, family === 4 ? "ipv4" : "ipv6");
}

/**
 * SSRF guard: only http(s), and the host must not resolve to a private or
 * internal address. (DNS can change between this check and the request; for a
 * prototype that's an accepted gap, listed in ROADMAP.md.)
 */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchBlockedError("invalid_url", `Unsupported protocol ${url.protocol}`);
  }
  if (url.username || url.password) throw new FetchBlockedError("invalid_url", "Credentials in URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new FetchBlockedError("private_address", `Refusing to fetch internal address for ${host}`);
  }
}

export interface SafeResponse {
  url: string;
  status: number;
  contentType: string;
  body: string;
}

/**
 * Fetches a public web page: SSRF-checked on every redirect hop, with a
 * timeout, a size cap and an identifying User-Agent.
 */
export async function safeFetch(
  input: string,
  options: { accept?: "html" | "text"; timeoutMs?: number } = {},
): Promise<SafeResponse> {
  let current: URL;
  try {
    current = new URL(input);
  } catch {
    throw new FetchBlockedError("invalid_url", `Invalid URL: ${input}`);
  }

  for (let hop = 0; hop <= LIMITS.fetch.maxRedirects; hop++) {
    await assertPublicUrl(current);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(options.timeoutMs ?? LIMITS.fetch.timeoutMs),
        headers: {
          "user-agent": userAgent(),
          accept: options.accept === "text" ? "text/plain,*/*;q=0.5" : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        },
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new FetchBlockedError(timedOut ? "timeout" : "http_error", `Request failed: ${String(error)}`);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new FetchBlockedError("http_error", "Redirect without location", response.status);
      current = new URL(location, current);
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) throw new FetchBlockedError("http_error", `HTTP ${response.status}`, response.status);
    if (options.accept !== "text" && !/html|xml/i.test(contentType)) {
      throw new FetchBlockedError("not_html", `Not an HTML page (${contentType})`);
    }
    return { url: current.toString(), status: response.status, contentType, body: await readCapped(response) };
  }
  throw new FetchBlockedError("too_many_redirects", "Too many redirects");
}

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > LIMITS.fetch.maxBytes) {
      await reader.cancel();
      throw new FetchBlockedError("too_large", "Page is larger than the size limit");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
