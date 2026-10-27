# Roadmap

What the prototype doesn't do yet, and what I'd build next. Grouped by how soon it matters.

## Known limits (today)

- **The local database is fragile.** Without `DATABASE_URL`, PGlite runs Postgres inside the Node process: only one process may open the data folder, and killing the server mid-write can corrupt it (happened once in testing; restored from a backup). It's for local use; anything shared runs on Neon (`DATABASE_URL`), with the same schema and migrations.
- **AI provider terms.** The AI runs on DeepSeek V4.1 Flash through OpenCode Go: fast (a quick search in 40–60 s instead of 5–8 minutes on Groq's free tier), no training, zero retention. But Go says it's designed for coding agents; for production, confirm this use with OpenCode or move to a general API plan (Groq paid, or Anthropic through its OpenAI-compatible endpoint). Switching is a settings change.
- **DeepSeek's accuracy is measured on a small overlap.** Re-running the 9 labelled searches (`pnpm eval:live`, 2026-10-27): of the hand-labelled centers it found, High was 11 of 12 real fits (92%) and every real fit ranked above every wrong one. Only 18 labelled centers came back, because search results drift between runs, and about 30 new centers still need hand labels.
- **Untuned countries are thinner.** The six tuned countries have cities, local job-ad words and tested coverage. The other 237 work from phone prefix, domain ending and country name only.
- **US centers are an open question.** The US is selectable, but `+1` numbers never count as a location (offshore centers use virtual US numbers), so US centers are placed by text and domain only. Waiting on the company's answer.
- **Removal requests need a code change.** Blocked companies are a config list (`src/config/blocked-domains.ts`), and it only stops new results; centers already saved stay until deleted by hand.
- **Rate limit trusts the IP header.** The per-visitor limit reads `x-forwarded-for`, which a client can fake unless a platform like Vercel sets it. The daily cap still applies to everyone.
- **No limit on access-code guesses.** It's a shared demo code, not user accounts.
- **DNS can change between the address check and the fetch.** Accepted for a prototype.
- **Confidence is a reading aid, not a measured probability.** Labels were checked against 48 hand-labelled results (High: 21 of 22 were real fits), but the sample is small and most were read by keyword rules, not the AI.

## Next month

- **Deploy:** Vercel with Neon Postgres. The database side is ready (`pnpm db:migrate` runs in `vercel-build`). Long searches need a background job (on Vercel's free plan a function stops after 5 minutes), e.g. a queue or Vercel's `after()` with a worker.
- **Blocked companies as a table:** `blocked_companies (domain, name, reason, requested_at)`, checked by the pipeline and filtered on read, so a removal takes effect immediately, including for saved centers. An admin button to add one.
- **Upload current partners:** exclude them from results, and use them as examples to tune scoring ("find more like these").
- **Tune more countries, by demand:** Jamaica, Honduras, Guatemala, El Salvador, Belize first, then wherever partners or users search most. Not all 243: most countries have no centers running US insurance campaigns.
- **Semi-automatic tuning:** a script drafts a config entry for a new country: biggest cities (GeoNames), search language, coverage from scripted test searches, and job words suggested from confirmed ads. A person reviews it before it's added, because local slang, job boards and exclusions need a human check. A new country takes minutes instead of a day.
- **Faster AI:** send only the paragraphs that mention insurance, or batch several short job ads into one call.
- **Editable lists in the database, with suggestions:** move the lists (domains, negative keywords, blocked companies, tuned countries) into the database with an admin page, so they change without a deploy and record who changed what and why. Past searches suggest new entries (e.g. "jobsora.com appeared in 14 searches and was never a center"), and a person approves each one; the tool never changes its own rules, so one wrong rule can't quietly hide good centers. Matching logic (negation, experience requirements) stays in code, where it's reviewed and tested.
- **Make the narrow rules general:** detect job-board listing pages by their content (several employers on one page) instead of URL patterns, check page titles for "top 20" posts, and add experience phrasings for each search language.
- **Measure accuracy properly:** more hand labels per country and campaign, including searches read by the AI; turn the Fit / Not a fit votes into a running precision number.
- **Several campaigns at once** (e.g. Medicare + final expense), with a score per campaign.
- **Saved searches** that highlight centers that are new since last time.
- **Scheduled re-checks** so evidence stays fresh; alert when a center starts a new campaign.
- **One loading pattern:** the center page refreshes the whole page after a vote or re-check; move it to React Query like the search page.

## Later

- **More sources, with permission:** data feeds from job boards (Rozee, Mustakbil, Computrabajo), official LinkedIn or Meta API access if the company has it, a search API plan that allows storing results.
- **Registry checks:** PSEB (Pakistan), PEZA (Philippines), and license checks for the US agents centers transfer calls to.
- **Learned weights:** adjust scoring points from reviewer votes once there are enough of them.
- **Team features:** login, editable scoring weights, a review workflow (status, notes, owner), CRM export (HubSpot).
- **City filter and a map view.**
