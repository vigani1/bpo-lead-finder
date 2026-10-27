import "server-only";
import { usesModel } from "./classifier-id";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { classificationCache } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { Doc } from "@/lib/pipeline/types";
import { createOpenAiCompatibleClassifier } from "./openai-compatible-classifier";
import { PROMPT_VERSION } from "./prompt";
import { rulesClassifier } from "./rules";
import { classificationSchema } from "./schema";
import { NO_USAGE, type Classifier, type ClassifyResult } from "./types";

let classifier: Classifier | undefined;

/**
 * The AI step: any OpenAI-compatible model API when one is configured
 * (AI_BASE_URL + AI_API_KEY: OpenCode Go, Groq, OpenRouter, Anthropic's
 * compatible endpoint…), otherwise the keyword rules.
 */
export function getClassifier(): Classifier {
  if (classifier) return classifier;
  const { AI_BASE_URL, AI_API_KEY } = env();
  classifier = AI_BASE_URL && AI_API_KEY ? createOpenAiCompatibleClassifier() : rulesClassifier;
  return classifier;
}

/** Classifies a document once per content hash; repeats come from the database. */
export async function classifyCached(db: Db, doc: Doc): Promise<ClassifyResult & { cached: boolean; fellBack?: boolean }> {
  const active = getClassifier();
  // Keyword rules are free and instant; only model calls are cached.
  if (!usesModel(active.id)) return { ...(await active.classify(doc)), cached: false };
  // The site asked not to be used as AI input (robots.txt content signal).
  if (doc.aiInputAllowed === false) return { ...(await rulesClassifier.classify(doc)), cached: false };

  // Keyed by classifier and prompt version, so a prompt change re-reads pages.
  const cacheKey = `${active.id}@prompt-v${PROMPT_VERSION}`;
  const [hit] = await db
    .select()
    .from(classificationCache)
    .where(and(eq(classificationCache.contentHash, doc.contentHash), eq(classificationCache.classifier, cacheKey)))
    .limit(1);
  if (hit) {
    const parsed = classificationSchema.safeParse(hit.result);
    if (parsed.success) return { classification: parsed.data, classifierId: active.id, usage: NO_USAGE, cached: true };
  }

  let result: ClassifyResult;
  try {
    result = await active.classify(doc);
  } catch (error) {
    // The model is down, over its free quota or returned bad output: read this
    // document with the keyword rules instead of losing it. Not cached, so it's retried next time.
    logger.warn("AI classifier failed, using keyword rules", { url: doc.url, error: String(error).slice(0, 300) });
    return { ...(await rulesClassifier.classify(doc)), cached: false, fellBack: true };
  }
  await db
    .insert(classificationCache)
    .values({ contentHash: doc.contentHash, classifier: cacheKey, result: result.classification })
    .onConflictDoNothing();
  return { ...result, cached: false };
}
