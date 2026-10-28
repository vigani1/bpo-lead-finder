# Notes

Running notes kept while building, for the write-up: where AI helped and where it was wrong.

Claude (Claude Code) wrote most of the code and the commit messages; every step was reviewed before it was committed.

## Where AI helped

- Research before any code: a cited report on sources, platform terms, directories and how others dedupe and score leads, then real test searches for each country and campaign. That showed early that job ads are the main evidence, that most job boards forbid automated access, and that coverage differs a lot by country.
- Reading the terms of more than 20 search APIs and other sources, with the clause, free tier, price and date for each (`docs/sources.md`). That is how Tavily was chosen over Brave, and why Exa is used for discovery only.
- Writing the code and the commit history, step by step, in the order the app was built, with a review of every batch of commits before it was pushed.
- Reading pages: the AI recognises employers and campaigns that the keyword rules miss when the wording isn't one they know. Moving from Groq's free tier to DeepSeek V4.1 Flash took a quick search from 5–8 minutes to under a minute.
- Measuring instead of guessing: the accuracy check against hand labels (`pnpm eval:scores`, `pnpm eval:live`) turned "looks right" into numbers, and showed which changes helped (High: 1 result before the scoring rules, 21 of 22 real fits after).
- An independent bug review before hand-in found nine bugs, among them: a failed database write skipped the rest of a search, a search cut off on Vercel could be reused, double clicks could run two re-checks, phone numbers broke in the CSV export, and personal data could reach the ruled-out titles.

## Where AI was wrong

- The first hosted-database client used Neon's serverless driver and ran migrations over the pooled URL every time the app started. Neon's own guidance for Vercel is node-postgres with `attachDatabasePool`, and migrations over the direct URL at deploy time; switched once the Neon project was set up.
- It checked robots.txt only for the first address of a page: when a site redirected elsewhere, the new address was fetched without asking its robots.txt. Every redirect hop is now checked.
- A private address written in IPv6 form (such as `::ffff:127.0.0.1`) passed the first internal-address guard. The guard now uses Node's `BlockList`, which also matches IPv4 addresses in their IPv6 forms.
- It parsed Groq's rate-limit hint "try again in 7m12s" as 12 seconds. The pattern now reads the minutes too.
- It read "experience in final expense" in job ads as the employer running final-expense campaigns, and telling it not to in the prompt didn't stop it. The rule became code: an experience requirement in a job ad isn't campaign proof.
- It accepted empty quotes as verified: an empty string is "found" in every page, so an empty answer passed as evidence. Quotes under 4 characters now prove nothing.
- When the model returned the same fact twice, one insert tried to write the same evidence row twice, Postgres rejected the whole insert, and the center lost all its evidence from that page. Repeats are now dropped before the insert.
- Its first scripts opened the local database without the `pg_trgm` extension that the center-name index needs, so writes to `centers` failed. Scripts now open it the way the app does (`scripts/lib/open-db.mts`). The local PGlite database was also corrupted once in testing, when the server was killed mid-write, and had to be restored from a backup.
- It marked a campaign "confirmed" in the results by a different rule than the score used. Both now use the same grading of campaign proof (`campaignProof` in `src/lib/scoring/score.ts`).
- It recognised a campaign but quoted a sentence that only described the work ("agents make outbound calls to … close sales") instead of the heading that named it ("Life Insurance Campaign Call Center"). The quote check rejected those claims, as designed, so real centers were lost. Found by testing new searches (India, life insurance); the prompt now asks for the words that name the campaign.
- Even with the prompt rule, it sometimes quoted a description of the work on a page dedicated to the campaign; the code now takes that page's own sentence naming the campaign. It also called lead buyers and campaign brokers call centers (Touchstone graded High, BPO Campaign Provider Medium) though the prompt described them; a two-phrase code check now overrules it.
- The pipeline read only the first 8 company websites to arrive and silently dropped the rest, though searches found 14–21 usable ones; and Pakistan final expense, the richest search, always hit the 40-document AI limit. Found by measuring where candidates were lost; websites are now read best-first, up to 15, with the AI limit at 80.
