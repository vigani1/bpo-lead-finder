# Only public business data is stored

The brief asks for public business information about call centers. The pages that prove a campaign are often about people too: job ads carry a recruiter's name and WhatsApp number, social posts are written by individuals, and freelancer and LinkedIn profiles are a person's page. We decided to store only what describes the business, and to drop personal data before anything stores it or sends it to the AI:

- **Snippets are cleaned first.** Phone numbers, personal-looking emails and titled names ("Mr Ahmed Khan") are removed from job-ad, social and gig snippets during triage. The text the classifier reads, and that quotes are checked against, is the cleaned text.
- **Personal pages leave no trace.** LinkedIn profiles and posts, job-seeker and freelancer profiles are ruled out with their path replaced by `[removed]`; not even their title is kept. Click-to-chat links (wa.me, t.me) are skipped for the same reason.
- **Contacts are business contacts.** Only role mailboxes (info@, sales@, careers@…) are kept as a center's emails.
- **Nothing from a source whose terms forbid it**: no LinkedIn text, nothing from Exa (ADR 0002).
- **Removal on request.** Companies that ask to be removed go on a list of domains and names (`src/config/blocked-domains.ts`) that the pipeline skips, so they never reappear in new results.

Visitors are identified for rate limiting by a salted hash of their IP address, never the address itself.

## Consequences

- A recruiter's direct number, often the quickest way to reach a center, is never shown.
- The removal list is a code change, and it only stops new results: centers already saved stay until they are deleted by hand.
