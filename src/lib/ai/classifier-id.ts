/**
 * Classifier ids are saved with each piece of evidence: "openai-compatible:<host>:<model>"
 * for the AI, "rules-v1" for the keyword rules. This helper reads them back; safe to use in the browser.
 */
export function usesModel(classifierId: string): boolean {
  return classifierId.startsWith("openai-compatible:");
}

