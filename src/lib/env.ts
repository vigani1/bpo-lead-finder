import "server-only";
import { z } from "zod";

// Empty strings in .env files mean "not set".
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional(),
);

const envSchema = z.object({
  TAVILY_API_KEY: optionalString,
  /** Optional second search index; used for discovery only (results are not stored). */
  EXA_API_KEY: optionalString,
  /** Any OpenAI-compatible model API (OpenCode Go, Groq, OpenRouter, Gemini, Ollama). Unset = keyword rules. */
  AI_BASE_URL: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.url().optional()),
  AI_API_KEY: optionalString,
  AI_MODEL: optionalString,
  /** Pace calls to the provider's tokens-per-minute limit (Groq free tier: 8000). Unset = no pacing. */
  AI_TOKENS_PER_MINUTE: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  /**
   * How the model is asked for JSON: `schema` (strict JSON-schema output, e.g. Groq) or `object`
   * (plain JSON mode with the schema in the instructions, for models without schema support, e.g. DeepSeek).
   * Either way, every answer is validated against the schema before use.
   */
  AI_JSON_MODE: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["schema", "object"]).default("schema"),
  ),
  AI_REASONING_EFFORT: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(["low", "medium", "high"]).optional(),
  ),
  /** `tavily` (default; keyless if no key) or `fixture` (offline sample data). */
  SEARCH_PROVIDER: z.enum(["tavily", "fixture"]).default("tavily"),
  /** Hosted Postgres (Neon) pooled connection string, for the app. Unset = PGlite in DATABASE_DIR. */
  DATABASE_URL: z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.url().optional()),
  DATABASE_DIR: z.string().default(".data/pglite"),
  IP_HASH_SALT: z.string().default("local-dev-salt"),
  CONTACT_URL: z.url().default("https://github.com/vigani1/bpo-lead-finder"),
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
