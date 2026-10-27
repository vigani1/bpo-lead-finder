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
- When the model returned the same fact twice, one insert tried to write the same evidence row twice, Postgres rejected the whole insert, and the center lost all its evidence from that page. Repeats are now dropped before the insert.
- Its first scripts opened the local database without the `pg_trgm` extension that the center-name index needs, so writes to `centers` failed. Scripts now open it the way the app does (`scripts/lib/open-db.mts`). The local PGlite database was also corrupted once in testing, when the server was killed mid-write, and had to be restored from a backup.
- It marked a campaign "confirmed" in the results by a different rule than the score used. Both now use the same grading of campaign proof (`campaignProof` in `src/lib/scoring/score.ts`).
- It recognised a campaign but quoted a sentence that only described the work ("agents make outbound calls to … close sales") instead of the heading that named it ("Life Insurance Campaign Call Center"). The quote check rejected those claims, as designed, so real centers were lost. Found by testing new searches (India, life insurance); the prompt now asks for the words that name the campaign.
- Even with the prompt rule, it sometimes quoted a description of the work on a page dedicated to the campaign; the code now takes that page's own sentence naming the campaign. It also called lead buyers and campaign brokers call centers (Touchstone graded High, BPO Campaign Provider Medium) though the prompt described them; a two-phrase code check now overrules it.
