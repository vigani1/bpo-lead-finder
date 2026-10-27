/**
 * Classifier ids are saved with each piece of evidence: "openai-compatible:<host>:<model>"
 * for the AI, "rules-v1" for the keyword rules. These helpers read them back; safe to use in the browser.
 */
export function usesModel(classifierId: string): boolean {
  return classifierId.startsWith("openai-compatible:");
}

/** How the evidence was read, for display: "AI (deepseek-v4.1-flash)" or "keyword rules". */
export function describeClassifier(classifierId: string): string {
  return usesModel(classifierId) ? `AI (${classifierId.split(":").at(-1)})` : "keyword rules";
}
