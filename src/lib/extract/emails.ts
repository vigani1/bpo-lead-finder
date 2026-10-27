import { parse } from "tldts";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Mailboxes that belong to a function, not a person: business contact info. */
const ROLE_MAILBOXES = new Set([
  "info",
  "contact",
  "contactus",
  "sales",
  "hello",
  "support",
  "admin",
  "office",
  "hr",
  "careers",
  "jobs",
  "business",
  "partnerships",
  "partners",
  "inquiries",
  "enquiries",
  "inquiry",
  "bd",
  "team",
  "operations",
  "ops",
]);

const IGNORED_DOMAINS = /(example\.com|sentry|wixpress|domain\.com|email\.com|yourdomain)/i;

/** "careers", "contact-us", "info.pk": separators are ignored, digits aren't ("5655756careers" is text run together). */
export function isRoleBased(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return ROLE_MAILBOXES.has(local.replace(/[._-]/g, "")) || ROLE_MAILBOXES.has(local.split(/[._-]/)[0] ?? "");
}

/** The domain must end in a real public suffix: page text run together gives "site.complot". */
function hasRealDomain(email: string): boolean {
  return parse(email.split("@")[1] ?? "").isIcann === true;
}

export function extractEmails(text: string, options: { roleBasedOnly: boolean }): string[] {
  const found = new Set<string>();
  for (const raw of text.match(EMAIL) ?? []) {
    const email = raw.toLowerCase().replace(/\.$/, "");
    if (IGNORED_DOMAINS.test(email) || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(email) || !hasRealDomain(email)) continue;
    if (options.roleBasedOnly && !isRoleBased(email)) continue;
    found.add(email);
  }
  return [...found];
}

/** Replaces personal-looking email addresses (keeps role mailboxes like hr@). */
export function stripPersonalEmails(text: string): string {
  return text.replace(EMAIL, (email) => (isRoleBased(email) ? email : "[email removed]"));
}
