# Project-specific rules

The general approach is in the ADRs: the AI extracts facts with quotes, and code decides. This page lists the specific rules that code applies, what each rule does, the real case from testing that led to it, and where it lives. Most of them came from looking at wrong results by hand. The accuracy check (`pnpm eval:scores` against `eval/labels.json`) is how we know they help.

Before the scoring rules (2026-10-26): 1 result labelled High, Medium 69% real fits, a real fit ranked above a wrong one 73% of the time. After: High 21 of 22 real fits (95%), ranking 99%.

## How general these rules are

Most rules came from real mistakes, but they describe general patterns, not the specific results that revealed them. For example, "an experience requirement isn't proof", "a page listing many employers proves nothing about each one", "negation flips the meaning" and "one strong proof beats many weak mentions" hold for any industry. The Medicare billing exclusions are domain knowledge: medical billing is a large offshore industry of its own.

Some rules are narrower, and would need extending for new sources or countries:

| Rule | Why it's narrow | Better version |
|---|---|---|
| Listing-page detection | Matches URL patterns of the boards we saw (`q-…-jobs`, `…-jobs.html`) | Detect by content: several employers named on one page |
| "Top 20" detection | Needs a number in the URL | Also check the page title |
| Experience-requirement check | English and Spanish phrasings only | Add phrasings per search language |
| Domestic life insurers | A hand-made list for Pakistan and India | A list per tuned country |
| Hidden-employer and placeholder words | Built from the pages we saw | Extend as new boards are added |
| Points, weights and thresholds | Tuned on 48 hand labels from 6 searches, mostly read by keyword rules | More labels, especially AI-read searches, then fit the numbers |

What guards against overfitting: 9 of the labels come from later searches that were never used while tuning, and on those nothing wrong scored above Low. Nine is too few to prove much, so the numbers are a reasonable start, not a measured optimum.

## Recognising a campaign

| Rule | Why (what went wrong without it) | Where | Effect |
|---|---|---|---|
| Medicare negative phrases: medical billing, AR calling, biller, medical coder, home health, credentialing, prior authorization, ICD-10, CPT codes, pharmacies… | Healthcare back-office jobs in Pakistan and India mention "US Medicare" all the time. They chase hospital claims and don't sell Medicare plans, but they showed up as Medicare centers. | `src/config/campaigns.ts` | The quote is rejected; the page doesn't count as Medicare |
| ACA is never matched as the bare word "ACA" | "ACA" also matched ACA International (debt collectors) and accounting bodies (ACCA). | `src/config/campaigns.ts`, `src/lib/campaign-match.ts` | Only "Obamacare", "Affordable Care Act", "ACA health/insurance/transfers"…; a bare "ACA" counts only next to insurance words |
| Life insurance excludes domestic insurers (State Life, Jubilee Life, EFU, Adamjee, LIC of India) and "employee benefits" | "Life insurance" searches in Pakistan and India are flooded by local insurers' own sales jobs, not BPOs running US campaigns. | `src/config/campaigns.ts` | Their pages don't count as US life campaigns |
| A negation shortly before the keyword cancels it ("we don't do Medicare", "sin seguros") | Pages saying what a center does not do were counted as doing it. | `src/lib/claim-checks.ts` (30 characters before the match) | The quote is rejected |
| In job ads, an experience requirement isn't proof: "experience in final expense preferred", "candidates with Medicare experience", and in Spanish "experiencia en Obamacare", "asesores con experiencia en seguros" ("con o sin experiencia" doesn't trigger it) | The AI kept reading these as the employer running the campaign, even after the prompt was told not to. A prompt change alone didn't fix it, so it became code. Spanish was added later, for the Colombia searches. | `src/lib/claim-checks.ts` (`EXPERIENCE_REQUIREMENT`) | Rejected for job ads; "experienced Final Expense closer" (a job title) still counts. Cautious: a quote like "experience in sales, Obamacare campaign" is rejected too, so it can miss a real campaign rather than invent one |
| A quote must be at least 4 characters | An empty quote is "found" in every page, so an empty answer from the AI passed as verified evidence. | `src/lib/pipeline/verify-claims.ts` | Empty or tiny quotes prove nothing |
| A quote must be at most 500 characters | A whole page "quoted" proves nothing, and a stored quote must fit the database index that keeps evidence unique. | `src/lib/pipeline/verify-claims.ts` | Over-long quotes are dropped and counted |
| Quotes are checked against the page exactly, then after normalising spaces, quote marks and case | Small formatting differences (curly quotes, line breaks) made true quotes fail. | `src/lib/pipeline/verify-claims.ts` | True quotes pass; invented ones are dropped and counted |
| Every check runs again at scoring time | Evidence saved under older rules would otherwise keep its old verdict. | `src/lib/scoring/score.ts` | Changing a rule changes the scores of saved centers too |

## What kind of page it is

| Rule | Why | Where | Effect |
|---|---|---|---|
| A job board page that lists many employers ("25+ Final Expense Closer Jobs") only proves the campaign for the page | The page title was credited to every employer listed on it, so unrelated companies got full job-ad points. | `src/lib/page-kinds.ts` (`isListingPageUrl`), `src/lib/scoring/score.ts` | Counts as a mention (10), unless that employer's own excerpt names the campaign |
| "Top 20 call centers" posts don't count for the site that wrote them | A blog listing other companies was scored as the writer's own campaign. | `src/lib/page-kinds.ts` (listicle) | No campaign credit |
| Blog and news posts are weaker than a service page | An old article mentioning Medicare isn't the same as "Medicare campaigns" on a services page. | `src/lib/page-kinds.ts` (article) | Counts as a mention, not "own site" |
| A date in the URL ("/2011/09/…") is used as the page date | Many pages have no date, so a 2011 blog post looked current. | `src/lib/page-kinds.ts` (`dateFromUrl`) | Old posts lose points under the recency rule |
| A hit with no insurance word at all is ruled out before it's read | It saves fetches and AI calls on pages that can't match. | `src/lib/pipeline/triage.ts` | Shown under "No mention of the campaign" |

## Location

| Rule | Why | Where | Effect |
|---|---|---|---|
| US and Canadian (+1) phone numbers never count as a location | Offshore centers show virtual US numbers so American clients can call them. | `src/lib/pipeline/country.ts` | Placed by their other signals instead |
| Signal weights: phone 3, job board 2, city 2, domain ending 2, text mention 1 | A phone prefix is hardest to fake; a passing mention is the weakest. | `src/lib/pipeline/country.ts` | The strongest total wins |
| "Confirmed" needs two different kinds of signal | One signal alone (e.g. a city name in a job ad) was sometimes wrong. | `src/lib/pipeline/country.ts`, `src/lib/scoring/score.ts` | Confirmed 15 points, likely 7 |
| Generic domain endings (.io, .ai, .tv, .me…) say nothing | Companies anywhere buy these endings. | `src/lib/all-countries.ts` | No domain signal (.co is not on the list: it still counts for Colombia, a deliberate exception) |
| A center not shown to be in the requested country is Low | Centers from other countries ranked high on campaign proof alone. | `src/lib/scoring/score.ts` | Always Low in a country search |

## Company names and duplicates

| Rule | Why | Where | Effect |
|---|---|---|---|
| Placeholder names are never centers: "Home Based Call Center", bare country or city names, dates, counts, job-board names | The AI or the rules took job titles and page headings for company names. | `src/lib/ai/rules/company-name.ts` (`isPlaceholderName`) | No center is created |
| "Confidential", "Pvt job", "Importante empresa"… mean the employer isn't named | Pakistani and Latin American boards hide the employer. | `src/config/signals.ts` (`HIDDEN_EMPLOYER_PATTERNS`) | Ruled out as "Employer not named" |
| Duplicates merge by domain first, then a phone shared by exactly one center, then a similar name | The domain is the most reliable; a phone shared by several centers is a directory or tracking line. | `src/lib/resolve/resolve-center.ts` | One center per company |
| Similar name needs ≥ 0.6 similarity (≥ 0.8 for names of 7 letters or fewer) | "Prime" vs "Prime III" must not merge on name alone. | `src/lib/resolve/normalize-name.ts` | Short names need near-exact matches |
| A city or country conflict blocks a name merge | "Prime BPO" in Lahore is not "Prime BPO" in Rawalpindi. | `src/lib/resolve/resolve-center.ts` | They stay separate |
| Only role emails are kept (info@, careers@, hr@); the domain must be real | A page produced `5655756careers@jsonscommunications.complot`: digits glued on and a fake ending. Personal emails are personal data. | `src/lib/extract/emails.ts` | Junk and personal emails dropped |

## Scoring

| Rule | Why | Where | Effect |
|---|---|---|---|
| Only the best piece of campaign proof counts: job ad 30, own website 25, mention 10 | Ten mentions shouldn't outscore one real job ad. | `src/lib/scoring/score.ts`, `src/config/scoring.ts` | No piling up of weak evidence |
| High needs a score of 70 or more **and** a job ad or own-website proof | Centers known only from mentions reached High. | `src/lib/scoring/score.ts` | Every High has direct proof |
| Bonuses: proof from two kinds of source +10, several distinct job ads +5 (reposts count once), works US hours +3 | Agreement between independent sources is stronger than either alone. | `src/lib/scoring/score.ts` | Small boosts on top |
| Penalties: red flag −20, resold or shared leads −20, only a freelance gig −10 | Benefit-bait ("$0 plan", "free cash card"), resold transfers and lone freelancers aren't partners. | `src/config/scoring.ts`, `src/config/signals.ts` | Pushed down the list |
| Only three red-flag categories count: resold or shared leads, benefit bait, high-risk campaigns | DeepSeek invented its own ("age requirement", "form data stored in Google Sheets"), each costing 20 points. Prime BPO dropped to Low because of them. | `src/config/signals.ts`, `src/lib/ai/schema.ts`, `src/lib/claim-checks.ts`, prompt v3 | Anything else is ignored, including old saved rows |
| Hospitals, health systems and insurers aren't call centers | DeepSeek graded a US hospital system's page (LifeBridge Health) as a Medium Medicare center in the Philippines. | `src/lib/ai/prompt.ts` (v3) | Classified as "other" |
| "Never resold" isn't a red flag | Lead Heroes' "100% exclusive leads — never shared, never recycled, never resold" was counted as advertising resold leads. | `src/lib/claim-checks.ts` (`redFlagQuoteVerdict`), also applied on the center page | No penalty, not shown as a red flag |
| Evidence up to 90 days counts fully, up to 180 days half, older nothing | Call centers switch campaigns; a two-year-old ad isn't proof today. | `src/config/scoring.ts` (`RECENCY`) | Old evidence fades |
| The score is the share of points that apply | An "any country" search can't earn location points, and shouldn't be marked down for it. | `src/lib/scoring/score.ts` | Fair across filters |

## Sources and data

| Rule | Why | Where | Effect |
|---|---|---|---|
| LinkedIn is links only, never its text | LinkedIn's User Agreement §8.2 also covers data obtained through third parties such as search engines. | `src/config/domains.ts` (`access: "skip"`) | No LinkedIn evidence is stored |
| Exa results are discovery only | Exa's terms (§4.2(a)) don't allow storing results; a URL is kept only after our own fetch confirms the site. | `src/lib/sources/exa.ts`, `src/lib/pipeline/triage.ts` | Exa-only snippets are never saved |
| A site that says `ai-input=no` in robots.txt is read with keyword rules, not the AI | Respecting the site's own Content Signal. | `src/lib/http/robots.ts`, `src/lib/ai/index.ts` | No AI call for that site |
| Personal phone numbers and emails are removed from job-ad and social snippets before anything reads them | The brief says public business information only. | `src/lib/extract/personal-data.ts` | No personal contacts stored |
| Spanish searches quote the product term (`"Obamacare" Estados Unidos`) | Without quotes, Spanish job boards returned generic "agente en español" jobs. | `src/lib/pipeline/build-queries.ts` | Relevant Spanish results |
| Tavily's country boost goes only on queries without a domain filter | Tavily returned nothing when both were combined. | `src/lib/pipeline/build-queries.ts` | Job-board queries still return results |
| Pages are cached for 7 days; failed fetches only for 6 hours | A site that was down or rate-limited once shouldn't stay "unreachable" for a week. | `src/config/limits.ts`, `src/lib/pipeline/fetch-site.ts` | Temporary failures heal on their own |
