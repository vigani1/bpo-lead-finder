import "server-only";
import { z } from "zod";

// Empty strings in .env files mean "not set".
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional(),
);

const envSchema = z.object({
  TAVILY_API_KEY: optionalString,
  /** `tavily` (default; keyless if no key) or `fixture` (offline sample data). */
  SEARCH_PROVIDER: z.enum(["tavily", "fixture"]).default("tavily"),
  /** Hosted Postgres (Neon) connection string. Unset = PGlite in DATABASE_DIR. */
  DATABASE_URL: optionalString,
  DATABASE_DIR: z.string().default(".data/pglite"),
  IP_HASH_SALT: z.string().default("local-dev-salt"),
  CONTACT_URL: z.url().default("https://github.com/call-center-lead-finder"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${problems.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}
