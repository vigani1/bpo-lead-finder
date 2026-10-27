import { createHash } from "node:crypto";

const ZERO_WIDTH = /[​-‍⁠﻿]/g;

/** Normalizes text for comparisons: Unicode, invisible chars, quotes, whitespace, case. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Lowercase, accents removed: "Bogotá" → "bogota". */
export function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds a phrase on word boundaries (so "medicare" doesn't match "lahoremedicare").
 * Works on accent-folded text. Returns the index in the folded text, or -1.
 */
export function findPhrase(foldedText: string, phrase: string): number {
  const folded = foldAccents(phrase);
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(folded)}(?=$|[^\\p{L}\\p{N}])`, "u");
  const match = pattern.exec(foldedText);
  return match ? match.index + match[1].length : -1;
}

/** Returns the sentence (or ~240-char window) around `index` in `text`. */
export function sentenceAround(text: string, index: number, maxLength = 240): string {
  const boundary = /[.!?\n•|]/;
  let start = index;
  while (start > 0 && !boundary.test(text[start - 1]!) && index - start < maxLength / 2) start--;
  let end = index;
  while (end < text.length && !boundary.test(text[end]!) && end - index < maxLength / 2) end++;
  return text.slice(start, end + 1).replace(/\s+/g, " ").trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function unique<T>(items: Iterable<T>): T[] {
  return [...new Set(items)];
}
