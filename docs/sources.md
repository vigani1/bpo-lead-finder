# Sources: what we use, and what we checked and didn't

The tool finds call centers through two search APIs and reads company websites directly. This page records why those two, and why each alternative was left out, with the source and the date it was checked. Terms and products change; re-check before relying on any row. The decision itself is ADR 0002.

## What we use

| Source | What it does here | Why this one | Terms (checked 2026-10-26) |
|---|---|---|---|
| **Tavily** | All query kinds: job ads (on job boards), Facebook and Instagram pages, company websites, freelance gigs, employer lookups | Its terms allow storing results for internal business use, so job-ad and social snippets can be kept as evidence. 1,000 free credits a month; a country boost; works without a key for testing | Storage allowed; its acceptable-use policy bars facilitating unsolicited marketing, so the list is for research, not mass outreach. [Tavily terms](https://www.tavily.com/terms), [acceptable use](https://www.tavily.com/acceptable-use-policy), [pricing](https://www.tavily.com/pricing) |
| **Exa** | Company-website discovery only: the website queries, one plain-English "company" search per search, and employer lookups | Its own index, different from Tavily's, and the best website-finder we measured: for the same queries it returned 46 company sites naming the searched campaign to Tavily's 11 (24 with Tavily's best wording) | Section 4.2(a) forbids copying results except temporary caching, so nothing from Exa is stored: a site it finds is kept only once our own fetch has read it. $10 free credit a month. [Exa terms](https://exa.ai/terms), [pricing](https://exa.ai/pricing) |
| **Company websites** | Fetched and read directly, up to 15 per quick search | They are where a center describes its own campaigns | robots.txt respected (including its `ai-input` signal), an identifying User-Agent, only the business pages we need |

Two search indexes are enough for this tool: more indexes mostly return the same public pages. The real limit is centers that don't publish their campaigns; the bigger gain is job-board data with permission (see ROADMAP.md).

## Checked and not used

| Option | What it is | Why not | Source (checked) |
|---|---|---|---|
| Google Custom Search JSON API | Google's official web-search API | Closed to new customers; existing customers lose it on 2027-01-01 | [Google Developers](https://developers.google.com/custom-search/v1/overview) (2026-10-26) |
| Google Vertex AI Search | Google's suggested replacement | Searches up to 50 chosen domains, not the open web; full-web search is partner-only with no public pricing | [Google Developers](https://developers.google.com/custom-search/v1/overview) (2026-10-26) |
| Scraping google.com directly | — | Google's terms forbid automated access against its robots.txt, which disallows `/search` | [Google Terms of Service](https://policies.google.com/terms) (2026-10-26) |
| Serper, SerpApi, DataForSEO | Resell scraped Google results | Built on scraping Google, against Google's terms; the brief asks us to respect each platform's terms. Google sued SerpApi (the DMCA claims were dismissed in July 2026, but the terms issue remains) | [SerpApi pricing](https://serpapi.com/pricing), [PPC Land on Google v. SerpApi](https://ppc.land/google-loses-dmca-bid-to-treat-search-scraping-like-dvd-piracy/) (2026-10-26) |
| Bing Web Search API | Microsoft's web-search API | Retired on 2025-08-11; its replacement (Grounding with Bing) doesn't return raw results to developers | [The Register](https://www.theregister.com/2025/05/15/bing_search_apis_retired/) (2026-10-26) |
| Brave Search API | Its own independent index, $5 per 1,000 requests | Storing results is allowed only "with a plan that includes storage rights"; which plans include them isn't public (the plans page needs a login), so it would mean a sales conversation. The best candidate if a third index is ever needed | [Brave Search API](https://brave.com/search/api/) (2026-10-27) |
| You.com Search API | Its own index, about $5 per 1,000 calls | Its storage terms weren't reviewed; nothing suggested it would find pages the other two miss | [You.com](https://you.com/resources/lower-search-api-cost) (2026-10-26) |
| Google Places API | Official Google Maps business listings, with phone and website | Only place IDs may be stored; phone and website must be fetched again each time ($35 per 1,000 for those fields after 1,000 free a month). Usable live on a center page later, not for building the list | [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies) (2026-10-26) |
| LinkedIn | Company and people pages | Its User Agreement (§8.2) also covers data obtained through third parties such as search tools, so not even its snippets are used; a link at most | [LinkedIn User Agreement](https://www.linkedin.com/legal/user-agreement) (2026-10-26) |
| Facebook, Instagram (direct) | — | Their terms forbid automated collection; their public pages are reached only as search-API snippets and links | Meta terms (2026-10-26) |
| Job boards (direct) | Rozee, Mustakbil, JobStreet, Indeed, Computrabajo… | Most forbid automated access, so only the search snippet and a link are used; a data feed with the board's permission would be the biggest single improvement | `src/config/domains.ts` (2026-10-26) |
| Apollo, ZoomInfo | Paid B2B contact databases | Paid; list "BPOs" in general, not which campaigns they run; mostly personal contact data gathered through contributor networks, and both have faced privacy suits | [Apollo API docs](https://docs.apollo.io/reference/organization-search) (2026-10-26) |
