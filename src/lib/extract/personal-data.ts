import { stripPersonalEmails } from "./emails";
import { stripPhoneNumbers } from "./phones";

/**
 * Job ads, social posts and gigs often contain a recruiter's name and
 * WhatsApp number. We remove numbers and personal emails before the text is
 * stored or sent to the AI (public business information only).
 */
export function stripPersonalData(text: string): string {
  return stripPersonalEmails(stripPhoneNumbers(text))
    .replace(/\b(whats\s?app|contact|call|text|sms)\s*(us|me)?\s*(at|on)?\s*:?\s*\[number removed\]/gi, "$1 [number removed]")
    .replace(/\b(Mr|Ms|Mrs|Miss|Sir|Madam)\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, "[name removed]");
}
