# Each source is used only as far as its terms allow

Most of the evidence about offshore call centers sits on platforms that forbid automated collection: job boards, LinkedIn, Facebook and Instagram. Scraping them would give more data but break their terms, and fetching them through a search API's page extraction would just be scraping them through someone else. So the tool only uses what each source's terms allow, and the rules live in config (`src/config/sources.ts` for search APIs, `src/config/domains.ts` for sites), checked against the terms and robots.txt on 2026-10-26:

- **Tavily** is the main search API. Its terms allow use for internal business purposes and don't restrict storing results, so its titles and snippets are stored as evidence.
- **Exa** is a second, independent index, used only to discover company websites. Its terms (4.2a) forbid copying information obtained through the service except temporary caching, so nothing from Exa is stored: a site it finds is kept only once our own fetch has read it.
- **Job boards** mostly forbid automated access in their terms: the search snippet and a link are used, and the page is never fetched.
- **Facebook and Instagram** (named in the brief) are used the same way, as a snippet and a link. Personal profiles and posts are dropped.
- **LinkedIn** is a link at most. Its User Agreement (§8.2) also covers information obtained through third parties such as search tools, so not even its snippets are used.
- **Company websites** are fetched and read, with robots.txt respected and a User-Agent that says who we are. A site whose robots.txt Content Signal says `ai-input=no` is read by the keyword rules, never sent to the AI.

Brave, Google Custom Search, Bing and OpenStreetMap were considered and not used: storage terms, closed or retired APIs, or too little data. The details, with sources and dates, are in `docs/sources.md`.

## Consequences

- A job ad is known only from its snippet, so some facts (full address, every campaign it mentions) are missed.
- Exa adds centers (in testing, a quick final-expense search in Pakistan went from 7 to 10–12) but never adds stored evidence of its own.
- Adding a source means an adapter plus a policy entry saying which kinds of query it gets and whether its results may be stored.
