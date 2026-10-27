import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Classification } from "@/lib/ai/schema";
import { env } from "@/lib/env";
import type { Doc } from "./types";

/**
 * Dev-only evaluation aid: when EVAL_DUMP_DIR is set, every classified document
 * is appended (one JSON per line) with what the classifier extracted, so results
 * can be audited by hand or turned into prepared classifications. Off by default.
 */
export async function dumpForEvaluation(searchId: string, doc: Doc, classification: Classification, classifierId: string) {
  const dir = env().EVAL_DUMP_DIR;
  if (!dir) return;
  const folder = path.resolve(/*turbopackIgnore: true*/ process.cwd(), dir);
  await mkdir(folder, { recursive: true });
  const line = JSON.stringify({
    searchId,
    url: doc.url,
    kind: doc.kind,
    contentHash: doc.contentHash,
    title: doc.title,
    registeredDomain: doc.registeredDomain,
    evidenceSource: doc.evidenceSource,
    facts: doc.facts ?? null,
    text: doc.text.slice(0, 6000),
    classifierId,
    classification,
  });
  await appendFile(path.join(folder, `${searchId}.jsonl`), `${line}\n`);
}
