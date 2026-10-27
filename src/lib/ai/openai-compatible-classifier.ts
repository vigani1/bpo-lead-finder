import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { LIMITS } from "@/config/limits";
import { env } from "@/lib/env";
import { userAgent } from "@/lib/http/safe-fetch";
import { logger } from "@/lib/logger";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { classificationSchema } from "./schema";
import { estimateTokens, TokenBudget } from "./token-budget";
import type { Classifier } from "./types";

/** Strict structured output needs `additionalProperties: false` on every object. */
function strictSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(classificationSchema, { target: "draft-7" }) as Record<string, unknown>;
  delete schema.$schema;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.type === "object") record.additionalProperties = false;
    Object.values(record).forEach((value) => (Array.isArray(value) ? value.forEach(visit) : visit(value)));
  };
  visit(schema);
  return schema;
}

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const MAX_RETRIES = 4;

/** What's wrong with an answer, in a line the model can act on; null when it's valid. */
function schemaProblem(content: string): string | null {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return "it isn't valid JSON";
  }
  const result = classificationSchema.safeParse(value);
  if (result.success) return null;
  return result.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

/**
 * The AI classifier, for any OpenAI-compatible chat API: OpenCode Go, Groq,
 * OpenRouter, Anthropic's or Gemini's compatibility endpoints, or a local Ollama.
 * Models without JSON-schema output (DeepSeek) use plain JSON mode with the
 * schema written into the instructions (`AI_JSON_MODE=object`).
 */
export function createOpenAiCompatibleClassifier(): Classifier {
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL, AI_JSON_MODE, AI_REASONING_EFFORT, AI_TOKENS_PER_MINUTE } = env();
  // Leave ~10% headroom: our estimate is rough.
  const budget = AI_TOKENS_PER_MINUTE ? new TokenBudget(Math.floor(AI_TOKENS_PER_MINUTE * 0.9)) : null;
  const model = AI_MODEL ?? "openai/gpt-oss-120b";
  const host = AI_BASE_URL ? new URL(AI_BASE_URL).hostname.replace(/^api\./, "") : "unknown";
  const schema = strictSchema();
  const systemPrompt =
    AI_JSON_MODE === "object"
      ? `${SYSTEM_PROMPT}\n\nReply with one JSON object that matches this JSON Schema exactly:\n${JSON.stringify(schema)}`
      : SYSTEM_PROMPT;
  const responseFormat =
    AI_JSON_MODE === "object" ? { type: "json_object" } : { type: "json_schema", json_schema: { name: "classification", strict: true, schema } };
  // OpenCode asks clients to name themselves and send a stable session id (it helps routing and prompt caching).
  // One id per server process: every request shares the same system prompt.
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${AI_API_KEY}`,
    "user-agent": userAgent(),
    ...(host.endsWith("opencode.ai") ? { "x-opencode-session": `lead-finder-${randomUUID()}` } : {}),
  };

  return {
    id: `openai-compatible:${host}:${model}`,
    label: `${model} via ${host}`,
    async classify(doc) {
      const body = {
        model,
        messages: <{ role: "system" | "user" | "assistant"; content: string }[]>[
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserMessage(doc, LIMITS.classifyMaxChars) },
        ],
        response_format: responseFormat,
        ...(AI_REASONING_EFFORT ? { reasoning_effort: AI_REASONING_EFFORT } : {}),
      };

      // The response schema isn't billed as prompt text, so it's left out of the estimate.
      const promptChars = systemPrompt.length + body.messages[1]!.content.length;
      const usage = { aiCalls: 0, inputTokens: 0, outputTokens: 0 };
      let repaired = false;
      for (let attempt = 0; ; attempt++) {
        const reservation = await budget?.reserve(estimateTokens(promptChars));
        const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        });

        // Free tiers rate-limit per minute: wait as told, a couple of times, then give up on this document.
        if (response.status === 429 && attempt < MAX_RETRIES) {
          const message = await response.text();
          // "try again in 7.5s" or, for the daily limit, "try again in 7m12.5s".
          const hint = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(message);
          const hinted = hint ? Number(hint[1] ?? 0) * 60 + Number(hint[2]) : Number(response.headers.get("retry-after"));
          const waitSeconds = Math.min(Math.ceil(hinted || 5 * (attempt + 1)) + 1, 60);
          logger.warn("AI rate limited, retrying", { waitSeconds, url: doc.url, message: message.slice(0, 300) });
          await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
          continue;
        }
        if (!response.ok) {
          throw new Error(`AI request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
        }

        const json = (await response.json()) as ChatResponse;
        reservation?.settle((json.usage?.prompt_tokens ?? 0) + (json.usage?.completion_tokens ?? 0));
        usage.aiCalls++;
        usage.inputTokens += json.usage?.prompt_tokens ?? 0;
        usage.outputTokens += json.usage?.completion_tokens ?? 0;
        const content = json.choices?.[0]?.message?.content;
        if (!content) throw new Error("AI returned no content");

        const problem = schemaProblem(content);
        if (!problem) return { classification: classificationSchema.parse(JSON.parse(content)), classifierId: this.id, usage };
        // Plain JSON mode doesn't enforce the schema: show the model what was wrong, once.
        if (repaired) throw new Error(`AI answer didn't match the schema: ${problem}`);
        repaired = true;
        logger.warn("AI answer didn't match the schema, asking again", { url: doc.url, problem });
        body.messages.push(
          { role: "assistant", content },
          { role: "user", content: `That JSON doesn't match the schema: ${problem}. Reply with the corrected JSON object only.` },
        );
      }
    },
  };
}
