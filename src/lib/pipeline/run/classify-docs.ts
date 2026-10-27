import "server-only";
import pLimit from "p-limit";
import { DEPTH_PRESETS, LIMITS } from "@/config/limits";
import { classifyCached } from "@/lib/ai";
import { logger } from "@/lib/logger";
import { dumpForEvaluation } from "../eval-dump";
import type { Doc } from "../types";
import { saveProgress, timed, type RunContext } from "./context";

const AI_FALLBACK_MESSAGE = "The AI model was unavailable for some pages, so they were read with keyword rules.";

/** Classifies documents a few at a time (up to the depth's budget). */
export async function classifyDocs(ctx: RunContext, docs: { doc: Doc }[]) {
  const limit = pLimit(LIMITS.concurrency.classify);
  const preset = DEPTH_PRESETS[ctx.filters.depth];
  await Promise.all(
    docs.map(({ doc }) =>
      limit(async () => {
        if (ctx.classifications >= preset.maxClassifications) return;
        ctx.classifications++;
        try {
          const { classification, classifierId, usage, fellBack } = await timed(ctx, "classifying", () => classifyCached(ctx.db, doc));
          if (fellBack && !ctx.progress.sourceErrors.some((e) => e.message === AI_FALLBACK_MESSAGE)) {
            ctx.progress.sourceErrors.push({ source: "classifier", message: AI_FALLBACK_MESSAGE });
          }
          ctx.progress.costs.aiCalls += usage.aiCalls;
          ctx.progress.costs.aiInputTokens += usage.inputTokens;
          ctx.progress.costs.aiOutputTokens += usage.outputTokens;
          ctx.progress.counts.classified++;
          await dumpForEvaluation(ctx.search.id, doc, classification, classifierId);
          await saveProgress(ctx);
        } catch (error) {
          // A parse or API failure marks this one document as failed; it never gets a default score.
          logger.warn("document failed", { searchId: ctx.search.id, url: doc.url, error: String(error) });
          ctx.progress.sourceErrors.push({ source: "classifier", message: `Could not classify ${doc.url}` });
        }
      }),
    ),
  );
}
