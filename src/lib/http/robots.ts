import "server-only";
import robotsParser from "robots-parser";
import { FetchBlockedError, ROBOTS_USER_AGENT, safeFetch } from "./safe-fetch";

type Robots = ReturnType<typeof robotsParser>;

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { robots: Robots | "allow_all" | "deny_all"; aiInput: boolean; expires: number }>();

/**
 * Content signals ("Content-Signal: search=yes, ai-input=no") let a site say its
 * pages may be read but not fed to an AI model. Applied to the whole site,
 * whichever user-agent group the line is in (the cautious reading).
 */
function allowsAiInputIn(robotsTxt: string): boolean {
  return !/^\s*content-signal\s*:.*\bai-input\s*=\s*no\b/im.test(robotsTxt);
}

/**
 * Checks robots.txt for our user agent. A missing robots.txt (404) allows
 * everything; an unreachable one (5xx, timeout) is treated as "disallow"
 * to stay on the safe side.
 */
export async function isAllowedByRobots(pageUrl: string): Promise<boolean> {
  const entry = await robotsFor(pageUrl);
  if (entry.robots === "allow_all") return true;
  if (entry.robots === "deny_all") return false;
  return entry.robots.isAllowed(pageUrl, ROBOTS_USER_AGENT) !== false;
}

/** Whether the site lets its pages be used as AI input (see `allowsAiInputIn`). */
export async function allowsAiInput(pageUrl: string): Promise<boolean> {
  return (await robotsFor(pageUrl)).aiInput;
}

async function robotsFor(pageUrl: string) {
  const origin = new URL(pageUrl).origin;
  const now = Date.now();
  let entry = cache.get(origin);
  if (!entry || entry.expires < now) {
    const robotsUrl = `${origin}/robots.txt`;
    let robots: Robots | "allow_all" | "deny_all";
    let aiInput = true;
    try {
      const response = await safeFetch(robotsUrl, { accept: "text", timeoutMs: 5_000 });
      robots = robotsParser(robotsUrl, response.body);
      aiInput = allowsAiInputIn(response.body);
    } catch (error) {
      const status = error instanceof FetchBlockedError ? error.status : undefined;
      robots = status !== undefined && status >= 400 && status < 500 ? "allow_all" : "deny_all";
    }
    entry = { robots, aiInput, expires: now + TTL_MS };
    cache.set(origin, entry);
  }
  return entry;
}
