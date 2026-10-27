# A search runs in the background of its own request

A search takes from under a minute to several minutes: dozens of search queries, website fetches and an AI call per document, and free AI tiers are slow. That is too long to hold a request open, but a separate job queue and worker is more infrastructure than a prototype needs.

So `POST /api/searches` saves the search and returns at once, and the pipeline runs in Next.js `after()` in the same function. Every stage saves its progress and its findings to the database as it goes, and the results page polls the search every 2 seconds until it is done or failed. An identical search (same country, market, campaign and depth) from the last 24 hours is reused instead of run again, unless the user asks for a live run.

The database is Postgres either way: Neon when `DATABASE_URL` is set (the deployed demo), otherwise PGlite on disk, so a fresh clone runs with no setup. On Neon the app connects with node-postgres over the pooled URL, with Vercel's `attachDatabasePool` closing idle connections, as Neon recommends for Vercel; migrations run once at deploy time (`pnpm db:migrate` in `vercel-build`) over the direct URL, because schema changes don't belong on the pooler and many instances starting at once shouldn't all migrate. PGlite migrates itself when the app opens it. PGlite runs Postgres inside the Node process, allows only one process on its data folder, and was corrupted once in testing when the server was killed mid-write, so it is for local use only.

## Consequences

- On Vercel a function stops after its `maxDuration`, 5 minutes on the free plan. A search still running then is cut off. A search still queued or running after 6 minutes on Vercel (30 locally, where free AI tiers can be slow) is reported as timed out and never reused. What it saved before that stays valid.
- Results appear live and survive a refresh, because they are saved as they are found.
- Reuse keeps repeated searches free, and the rate limits are counted from the same searches table, with no extra service.
- If searches outgrow the 5-minute limit, the fix is a real background job (a queue and a worker), not a change to the pipeline.
