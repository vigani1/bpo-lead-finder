# Notes

Running notes kept while building, for the write-up: where AI helped and where it was wrong.

Claude (Claude Code) wrote most of the code and the commit messages; every step was reviewed before it was committed.

## Where AI helped

## Where AI was wrong

- The first hosted-database client used Neon's serverless driver and ran migrations over the pooled URL every time the app started. Neon's own guidance for Vercel is node-postgres with `attachDatabasePool`, and migrations over the direct URL at deploy time; switched once the Neon project was set up.
- A private address written in IPv6 form (such as `::ffff:127.0.0.1`) passed the first internal-address guard. The guard now uses Node's `BlockList`, which also matches IPv4 addresses in their IPv6 forms.
- It parsed Groq's rate-limit hint "try again in 7m12s" as 12 seconds. The pattern now reads the minutes too.
- It read "experience in final expense" in job ads as the employer running final-expense campaigns, and telling it not to in the prompt didn't stop it. The rule became code: an experience requirement in a job ad isn't campaign proof.
- It accepted empty quotes as verified: an empty string is "found" in every page, so an empty answer passed as evidence. Quotes under 4 characters now prove nothing.
