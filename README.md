# Call Center Lead Finder

Finds offshore and nearshore call centers that run US insurance campaigns (Medicare, ACA/Obamacare, final expense, life insurance). Pick a campaign, a country and a market; the app searches job ads, company websites and public business pages, and returns each center with its public business contacts, the campaigns it appears to run, the exact quotes that prove it, where each quote came from, and how confident the match is.

Results are leads to vet, not endorsements. The tool finds; it never contacts anyone.

## Quick start

```bash
git clone https://github.com/vigani1/bpo-lead-finder.git
cd bpo-lead-finder
pnpm install
cp .env.example .env.local   # then fill in what you have (all optional)
pnpm dev                     # http://localhost:3000
```

No external database is needed: without `DATABASE_URL` the app runs Postgres in-process ([PGlite](https://pglite.dev)) and stores it in `.data/`. Migrations run automatically on first start.

### Hosted database (Neon)

For a deployment, use Postgres on [Neon](https://neon.com). Set `DATABASE_URL` (the pooled connection, used by the app) and `DATABASE_URL_UNPOOLED` (the direct one, used for migrations); `neon env pull` writes both. Then apply the migrations once:

```bash
pnpm db:migrate   # also runs on every Vercel deploy (vercel-build)
```

The app connects with node-postgres and never migrates the hosted database itself. Same schema, same migrations and the same `pg_trgm` extension as PGlite. Why it's built this way: [ADR 0004](docs/adr/0004-search-runs-in-the-background.md).

### Modes

| Setting | What happens |
|---|---|
| `DATABASE_URL` set | Postgres on Neon instead of the local PGlite database. |
| `SEARCH_PROVIDER=fixture` | Offline. Uses recorded real search results (`fixtures/search-hits.json`); company websites are still fetched live. |
| `SEARCH_PROVIDER=tavily`, no key | Live search through Tavily's keyless mode (small hourly caps). |
| `TAVILY_API_KEY` set | Live search with your free key (1,000 credits/month). Also enables rendering of JavaScript-only company sites. |
| `EXA_API_KEY` set | Adds Exa, a second, independent search index, used to discover company websites (free $10 credit/month). |
| `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL` set | Any OpenAI-compatible model reads each page. Currently DeepSeek V4.1 Flash through OpenCode Go (`AI_JSON_MODE=object`, `AI_REASONING_EFFORT=low`): no training on the data, zero retention per OpenCode's privacy table, about 40–60 s per quick search. Groq works the same way. |
| No AI settings | Keyword rules read each page instead: free and instant, but they miss employers that aren't named in a recognisable way. |
| `ACCESS_CODE` set | Every page and API call needs the code first (protects a public demo's credits). |

A quick search uses about 5 Tavily credits; a thorough one about 12 to 20.

## How a search works

```
POST /api/searches → returns at once; the page polls GET /api/searches/:id every 2 s
  after():
   1. build queries     filters + src/config → company / hiring / social / vendor queries (EN + ES)
   2. discover          every query goes to each source whose policy covers it (src/config/sources.ts):
                        Tavily for everything, Exa for company websites; hits tagged storable or transient
   3. triage            no AI: company sites to fetch; job ads, social pages, gigs as link-only snippets;
                        personal profiles, messaging links and SEO pages dropped; personal numbers stripped
   4. read websites     robots.txt respected, SSRF-guarded, 7-day cache, JS-only sites rendered via Tavily Extract
   5. classify          an AI model (any OpenAI-compatible API; DeepSeek via OpenCode Go today), or keyword rules: entity type, employer, city, campaigns, role,
                        market, country signals, compliance language, red flags; every claim with a quote
   6. verify            code checks each quote is really on the page and that it supports the claim
   7. resolve           merge duplicates: same domain → same phone → similar name + same city
   8. score             plain code, from the evidence (see /scoring); recalculated when filters change
```

Everything is saved as it's found, so results appear live and survive a refresh. Identical searches within 24 hours are reused; "Search again live" forces a new run. Centers known from earlier searches show up immediately.

## Sources and platform terms

Why these sources, and every alternative that was checked and left out (with links and dates): [docs/sources.md](docs/sources.md). Why evidence has to come from a source that allows storing it: [ADR 0007](docs/adr/0007-evidence-is-stored.md).

| Source | How it's used | Why |
|---|---|---|
| Tavily search API | Discovery (all query kinds); results stored as evidence | Licensed API; its terms allow storing results for internal use |
| Exa search API | Discovery of company websites only; **nothing from Exa is stored**, we read and store the company's own site | Exa's terms (4.2a) forbid copying information obtained through the service, except temporary caching |
| Company websites | Fetched and read | robots.txt respected, identifying User-Agent, rate-limited |
| Job boards (Indeed, Rozee, Mustakbil, Computrabajo…) | Search snippet + link only | Most forbid automated access in their terms |
| LinkedIn, Facebook, Instagram | Search snippet + link only; personal profiles and posts dropped | Terms forbid scraping |
| Fiverr, Upwork | Snippet + link, weak evidence | Self-claimed; often individuals or resellers |
| Directories (Clutch, Outsource Accelerator…) | Link only | Terms or bot protection; rarely list insurance centers |
| Brave, Google Custom Search, Bing, OpenStreetMap | Not used | Storage terms, closed or retired APIs, too little data |

Domain rules live in `src/config/domains.ts`. Why each source is used the way it is: [ADR 0002](docs/adr/0002-sources-and-platform-terms.md); what is stored and what never is: [ADR 0003](docs/adr/0003-what-we-store.md).

## Project structure

```
src/
  app/                 pages and API routes only: they parse input and call a feature
  components/          shared UI (header, theme toggle, confidence badge, quotes) + shadcn ui/
  config/              data only: campaigns, the 6 tuned countries, markets, domains, scoring weights, limits
  features/
    searches/
      components/      search form, live progress, results table and filters, ruled-out panel
      server/          start-search, usage (rate limits), search-view, result-rows (pure), ruled-out (pure), summary
      hooks.ts keys.ts schemas.ts types.ts
    centers/
      components/      evidence list, score breakdown, contacts, feedback, re-check
      server/          center-view, feedback
      types.ts
    meta/              filter options (all countries, server) and coverage hints (browser-safe)
  lib/
    api/               one error type, one response shape, one route wrapper
    ai/                one AI classifier for any OpenAI-compatible API (OpenCode Go, Groq…), plus keyword rules
      rules/           keyword rules: entity type, company name, shared matching
    db/                Drizzle schema; Postgres (Neon) or PGlite client
    extract/           page text, JSON-LD, phones (E.164), role emails, personal-data stripping
    http/              SSRF-safe fetch, robots.txt
    pipeline/          build queries, discover, triage, fetch site, verify, evidence, recheck, stages
      run/             one search end to end: context, classify-docs, fetch-sites, persist-doc, results
    resolve/           name normalisation and duplicate merging
    scoring/           pure scoring function
    sources/           Tavily, Exa and the offline fixture source
    all-countries.ts   every other country, derived from libphonenumber (prefix, domain, time zone)
    page-kinds.ts      what a URL is: social platform, personal profile, job listing page, listicle, article
    clock.ts           local times and the US calling window (home page clocks)
    format.ts          labels and display formatting, typed by the values they describe
  proxy.ts             optional access-code gate
scripts/               migrate, eval-scores, eval-live, export-results, check-rules-classifier, compare-classifiers
fixtures/              recorded search results for offline mode
drizzle/               SQL migrations
eval/                  hand labels for the accuracy check
docs/                  decision records (adr/) and every matching and scoring rule (rules.md)
```

The shared vocabulary (center, evidence, campaign proof, ruled out, tuned country…) is in [CONTEXT.md](CONTEXT.md). Every project-specific matching and scoring rule, with the case that led to it, is in [docs/rules.md](docs/rules.md). The main decisions are in [docs/adr/](docs/adr/).

## JSON API

The pages call the server functions directly; the same data is also available as JSON, for scripts or another front end. Every route validates its input with Zod and returns `{ error: { code, message } }` on failure.

| Route | What it does |
| --- | --- |
| `POST /api/searches` | Start a search (`campaign`, `country`, `market`, `depth`) or reuse a recent identical one |
| `GET /api/searches/:id` | A search's progress and results (same filters as the results page) |
| `GET /api/searches/:id/export` | Results as CSV |
| `GET /api/centers/:id` | One center with its evidence and score |
| `POST /api/centers/:id/recheck` | Re-read one center's website or search its name again |
| `POST /api/centers/:id/feedback` | Save a fit / not-fit vote |
| `GET /api/meta` | Filter options: campaigns, all countries, markets, depths |
| `GET /api/usage` | Searches left this hour |

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm typecheck` / `pnpm lint` | Type and lint checks (`typecheck` generates the Next.js route types first, so it works on a fresh clone) |
| `pnpm check:rules` | Runs the keyword classifier on real live titles/snippets; no API calls |
| `DATABASE_URL= DATABASE_DIR=/tmp/eval-db pnpm eval:live` | Re-runs the hand-labelled searches live with the current AI model in a separate, empty local database (it refuses to run with `DATABASE_URL` set, so test searches never reach Neon); then `EVAL_SNAPSHOT=eval-dumps/live-results.json pnpm eval:scores` scores them. Uses real search credits |
| `pnpm compare:classifiers` | Keyword rules vs the AI on the same saved documents (needs `EVAL_DUMP_DIR`) |
| `pnpm eval:scores` | Re-scores a frozen snapshot of results (`eval-dumps/eval-snapshot.json`) with the current code and compares the confidence labels with the hand labels in `eval/labels.json` |
| `pnpm export:results` | Writes all results with their evidence to `eval-dumps/results.json`, for labelling |
| `pnpm db:generate` | New migration after a schema change |
| `pnpm db:migrate` | Applies the migrations to the hosted database (`DATABASE_URL_UNPOOLED`); runs on every Vercel deploy |

## What live testing showed (2026-10-26)

- **Pakistan** has the most public data: a quick final-expense search finds 7 to 8 named centers (e.g. Reliant BPO, Falco Connect BPO, Sybrid, Touchstone Communications).
- **Most evidence is job ads**, and many centers have no website. Job ads count as the strongest proof that a campaign is active.
- **Listing pages bundle several employers**; Tavily separates their excerpts with `[...]`, and each excerpt is read on its own.
- **Tavily returns nothing** when a country boost is combined with a domain filter, so job-board queries don't use the boost.
- **Colombia, Spanish, ACA** works but is thin (2 centers on a thorough search); the Dominican Republic and India have little public data. The app says so up front.
- **Adding Exa** (a second, independent index) took a quick final-expense search from 7 to 10–12 centers; most of Exa's results were pages Tavily hadn't returned (16 of 20 on a quick search, 46 of 65 on a thorough one).
- **Without an AI key**, the keyword rules miss employers that aren't named in a recognisable way (they're ruled out as "employer not named", never guessed).

## How accurate the confidence labels are (2026-10-26)

Every result from 9 live searches was labelled by hand from its evidence (`eval/labels.json`):
fit, partial (plausible but weakly shown) or not a fit. `pnpm eval:scores` re-scores a frozen
snapshot of them (`eval-dumps/eval-snapshot.json`) with the current code and compares. 48 of the 50
labels are scored: one center isn't in the snapshot, and one ("Home Based Call Center") is now
refused as a placeholder name. 39 were used while changing the scoring; 9 come from four later
searches it wasn't tuned on.

| | High | Medium | Low |
|---|---|---|---|
| Real fits | 21 | 6 | 0 |
| Partial | 1 | 6 | 4 |
| Not a fit | 0 | 0 | 10 |

- **High was right 21 of 22 times** (95%); the miss is a staffing agency posting a real FE job.
- **Low holds no real fits**; Medium is the "check it yourself" band, about half real fits.
- A real fit outranks a wrong one 99% of the time (100% on the held-out searches).
- Before these changes only 1 result was High, Medium was 69% right, and fits outranked wrong ones 73% of the time.

What changed: only the strongest proof of the campaign counts (a job ad naming the employer, the
company's own service page, or a mere mention), so one good source can reach High; job-listing
page titles, "Top 20" blog posts and dated blog posts count less or not at all; healthcare admin
jobs and "candidates with Medicare experience" aren't campaign proof; "never resold" isn't a
red flag; a center not shown to be in the requested country is Low.

Caveats: 48 labels by one person is a small sample (±10 points or so), and the held-out set is
thin because those markets have little public data. The Fit / Not a fit buttons collect more labels.

**With the AI model** (`pnpm eval:live`, 2026-10-27): re-running the 9 labelled searches with
DeepSeek V4.1 Flash, every labelled center graded High was a real fit (12 of 12), Medium 3 of 4
(the other was a partial fit), and a real fit outranked a wrong one 94% of the time (20 labelled
centers came back). Earlier runs: High 11 of 12 (first AI run), 14 of 15 (after the quote and
campaign-buyer fixes), 9 of 9 (after the discovery fixes). Two runs of the
same searches share only about half their centers: each quick search samples ~60 results, so the
pool is bigger than any one run shows (two runs together found about 89 different centers). In the
app, later searches start with the centers earlier ones found, so the list grows with use. The run
is saved in `eval-dumps/live-results.json`: `EVAL_SNAPSHOT=eval-dumps/live-results.json pnpm eval:scores`.

## Accessibility

- Confidence is a word plus a three-bar meter, never colour alone.
- A skip link jumps past the header; headings go in order on every page, and the ruled-out panel says what it opens.
- Only the short progress line is announced while a search runs.
- Filters are labelled form controls and explain themselves in tooltips; the scoring tables have column headers for screen readers.
- Reduced-motion settings stop animations, including the loading spinners.
- [React Doctor](https://github.com/millionco/react-doctor) scores the code 100/100.

## Known limits

The full list, with what I'd build next, is in [ROADMAP.md](ROADMAP.md). The main ones:

- PGlite, the no-setup local database, is single-process and fragile: killing the server mid-write corrupted it once during testing (restored from a backup). Anything shared runs on Neon (`DATABASE_URL`); schema and queries are the same.
- DNS can change between the SSRF check and the request (accepted for a prototype).
- Confidence labels are a reading aid, not a measured probability; the "Fit / Not a fit" votes are the start of measuring it.
