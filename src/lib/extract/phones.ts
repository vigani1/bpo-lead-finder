import { findPhoneNumbersInText, type CountryCode } from "libphonenumber-js/max";

/** Finds phone numbers in text and returns them in E.164 (+923001234567) form. */
export function extractPhones(text: string, defaultCountry?: CountryCode): string[] {
  const found = new Set<string>();
  for (const match of findPhoneNumbersInText(text, defaultCountry ? { defaultCountry } : undefined)) {
    if (match.number.isValid()) found.add(match.number.number);
  }
  return [...found];
}

/** Country (ISO2) of an E.164 number, e.g. "+92..." → "PK". */
export function phoneCountry(e164: string): string | undefined {
  const matches = findPhoneNumbersInText(e164);
  return matches[0]?.number.country;
}

/** Removes anything that looks like a phone number (used to strip personal numbers from job ads). */
export function stripPhoneNumbers(text: string): string {
  let result = text;
  for (const match of [...findPhoneNumbersInText(text)].reverse()) {
    result = `${result.slice(0, match.startsAt)}[number removed]${result.slice(match.endsAt)}`;
  }
  // Local-format mobiles (e.g. 0300-1234567) without a country code.
  return result.replace(/(?<!\d)(?:\+?\d[\d\s-]{8,}\d)(?!\d)/g, "[number removed]");
}
