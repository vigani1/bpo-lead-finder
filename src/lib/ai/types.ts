import type { Doc } from "@/lib/pipeline/types";
import type { Classification } from "./schema";

export interface ClassifyUsage {
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ClassifyResult {
  classification: Classification;
  /** Which classifier produced it (stored on every piece of evidence). */
  classifierId: string;
  usage: ClassifyUsage;
}

/** The AI step sits behind this interface, so the app runs with or without an API key. */
export interface Classifier {
  id: string;
  label: string;
  classify(doc: Doc): Promise<ClassifyResult>;
}

export const NO_USAGE: ClassifyUsage = { aiCalls: 0, inputTokens: 0, outputTokens: 0 };
