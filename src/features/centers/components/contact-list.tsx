import { ExternalLinkIcon, GlobeIcon, MailIcon, PhoneIcon } from "lucide-react";
import type { CenterView } from "@/features/centers/types";

/** The center's published business contacts: phones, role emails, website and social pages. */
export function ContactList({ center }: { center: CenterView["center"] }) {
  const hasContact = center.phones.length + center.emails.length + center.socialLinks.length > 0 || !!center.websiteUrl;

  return (
    <section aria-labelledby="contact-heading" className="space-y-3">
      <h2 id="contact-heading" className="text-sm font-medium">
        Business contact
      </h2>
      <ul className="space-y-1.5 text-sm">
        {center.phones.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <PhoneIcon className="size-4 text-muted-foreground" />
            <a href={`tel:${p}`} className="hover:underline tabular-nums">
              {p}
            </a>
          </li>
        ))}
        {center.emails.map((e) => (
          <li key={e} className="flex items-center gap-2">
            <MailIcon className="size-4 text-muted-foreground" />
            <a href={`mailto:${e}`} className="hover:underline">
              {e}
            </a>
          </li>
        ))}
        {center.websiteUrl ? (
          <li className="flex items-center gap-2">
            <GlobeIcon className="size-4 text-muted-foreground" />
            <a href={center.websiteUrl} target="_blank" rel="noreferrer" className="hover:underline">
              {center.domain}
            </a>
            {center.websiteStatus === "js_only" ? <span className="text-muted-foreground">(partly readable)</span> : null}
          </li>
        ) : null}
        {center.socialLinks.map((s) => (
          <li key={s.url} className="flex items-center gap-2">
            <ExternalLinkIcon className="size-4 text-muted-foreground" />
            <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
              {s.platform}
            </a>
          </li>
        ))}
        {hasContact ? null : <li className="text-muted-foreground">No published business contact yet. The job ads in the evidence are the way in.</li>}
      </ul>
    </section>
  );
}
