/**
 * Runs the keyword rules and the configured AI model on the same saved
 * documents (from EVAL_DUMP_DIR) and writes both results side by side, so the
 * two can be judged against what each document really says.
 *
 *   EVAL_DUMP_DIR=eval-dumps pnpm dev   # run some searches
 *   pnpm compare:classifiers            # then compare
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createOpenAiCompatibleClassifier } from "../src/lib/ai/openai-compatible-classifier";
import { rulesClassifier } from "../src/lib/ai/rules/index";
import type { Doc } from "../src/lib/pipeline/types";
import { verifyClaims } from "../src/lib/pipeline/verify-claims";

const dir = process.env.EVAL_DUMP_DIR ?? "eval-dumps";
const docs: Doc[] = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl") && f !== "compare.jsonl")) {
  for (const line of readFileSync(`${dir}/${file}`, "utf8").split("\n").filter(Boolean)) {
    const d = JSON.parse(line);
    if (docs.some((x) => x.contentHash === d.contentHash)) continue;
    docs.push({ url: d.url, kind: d.kind, title: d.title, text: d.text, contentHash: d.contentHash, registeredDomain: d.registeredDomain ?? null, evidenceSource: d.evidenceSource ?? "job_board", facts: d.facts ?? undefined, publishedAt: null });
  }
}

const ai = createOpenAiCompatibleClassifier();
const out: string[] = [];
let i = 0;
for (const doc of docs) {
  i++;
  const rules = (await rulesClassifier.classify(doc)).classification;
  let model: unknown = null;
  let modelError: string | null = null;
  let dropped = 0;
  try {
    const result = await ai.classify(doc);
    model = result.classification;
    dropped = verifyClaims(doc, result.classification).dropped.length;
  } catch (error) {
    modelError = String(error).slice(0, 200);
  }
  out.push(JSON.stringify({ i, url: doc.url, kind: doc.kind, title: doc.title, text: doc.text.slice(0, 700), rules, model, modelError, modelClaimsDropped: dropped }));
  process.stdout.write(`${i}/${docs.length} `);
}
writeFileSync(`${dir}/compare.jsonl`, `${out.join("\n")}\n`);
console.log(`\nWrote ${out.length} comparisons to ${dir}/compare.jsonl`);
