# Sources: what we use, and what we checked and didn't

The tool finds call centers through two search APIs and reads company websites directly. This page records why those two, and why each alternative was left out, with the source and the date it was checked. Terms and products change; re-check before relying on any row. The decision itself is ADR 0002.

## What we use

| Source | What it does here | Why this one | Terms (checked 2026-10-26) |
|---|---|---|---|
| **Tavily** | All query kinds: job ads (on job boards), Facebook and Instagram pages, company websites, freelance gigs, employer lookups | Its terms allow storing results for internal business use, so job-ad and social snippets can be kept as evidence. 1,000 free credits a month; a country boost; works without a key for testing | Storage allowed; its acceptable-use policy bars facilitating unsolicited marketing, so the list is for research, not mass outreach. Free: 1,000 credits a month, no card ($8 per 1,000 after). [Tavily terms](https://www.tavily.com/terms), [acceptable use](https://www.tavily.com/acceptable-use-policy), [pricing](https://www.tavily.com/pricing) |
| **Exa** | Company-website discovery only: the website queries, one plain-English "company" search per search, and employer lookups | Its own index, different from Tavily's, and the best website-finder we measured: for the same queries it returned 46 company sites naming the searched campaign to Tavily's 11 (24 with Tavily's best wording) | Section 4.2(a) forbids copying results except temporary caching, so nothing from Exa is stored: a site it finds is kept only once our own fetch has read it. Free: $10 credit a month plus a $10 signup bonus, no card. [Exa terms](https://exa.ai/terms), [pricing](https://exa.ai/pricing) |
| **Company websites** | Fetched and read directly, up to 15 per quick search | They are where a center describes its own campaigns | robots.txt respected (including its `ai-input` signal), an identifying User-Agent, only the business pages we need |

Two search indexes are enough for this tool: more indexes mostly return the same public pages. The real limit is centers that don't publish their campaigns; the bigger gain is job-board data with permission (see ROADMAP.md).

## Checked and not used

"Store" means keeping results as evidence after the search, which this tool needs for job-ad and social snippets: why it stores them, rather than searching live and keeping nothing, is ADR 0007 (`docs/adr/0007-evidence-is-stored.md`). A source that may not be stored can still help find company websites, as Exa does.

### Search APIs

| Option | What it is | Free tier | Price per 1,000 | Can we store results? | Why not (what it would violate) | Verdict | Source (checked) |
|---|---|---|---|---|---|---|---|
| **Mojeek** | Its own independent index (UK) | Free credit; bank card required | £2 (Startup), £3 (Business) | Startup: cache 1 hour only. Business: "storage rights which permit indefinite data retention" | Nothing found against it on the Business plan; outside search screens its data may only be used to discover sources. Not added: two indexes are enough for now | **Usable** (Business plan); the best third source if one is needed | [Mojeek API](https://www.mojeek.com/services/search/web-search-api/) (2026-10-27) |
| **Perplexity Search API** | AI search on its own index | Not found | $5 ($1 fast mode) | Customer "owns all Output"; no storage limit found | Its policy bans "unsolicited advertising" and "unauthorized collections of personal data"; Perplexity is being sued (Reddit v. Perplexity) over Google results obtained through SerpApi | Usable with caveats | Perplexity API terms (2026-10-27) |
| **Brave Search API** | Its own independent index | $5 credit a month; card required | $5 | Terms forbid storing "other than transient storage" unless on a plan with storage rights; which plan is not public | Storing snippets breaks its terms on the self-serve plans | Discovery only | [Brave API terms](https://api-dashboard.search.brave.com/terms-of-service) (2026-10-27) |
| **Parallel** | AI search on its own index | 5,000 requests a month | $1–$5 | Customer owns output, but may not "create databases" or reuse outputs of earlier queries | A lead database is what its terms (§2(c)(vi)(B)) forbid | Discovery only | Parallel customer terms (2026-10-27) |
| **Linkup** | AI search API | $20 a month credit (work email) | $5 | Web content licensed for text and data mining only, no redistribution | Showing stored snippets to users goes beyond its licence | Discovery only | Linkup terms (2026-10-27) |
| **Kagi Search API** | Own small indexes plus unnamed providers | None found | $12 | "Transient caching" only | Storing results breaks its API terms | Discovery only; expensive | Kagi API terms (2026-10-27) |
| **Valyu** | AI search over web and licensed sources | $10 signup credit | about $6 | Temporary caching only; attribution required | Its agreement bans "dataset construction" | Discovery only | Valyu service agreement (2026-10-27) |
| **You.com Search API** | AI search API | About $10 credit (~2,000 searches) | $5 | API terms not found | Unknown | Unclear | [You.com pricing](https://you.com/pricing) (2026-10-27) |
| **Firecrawl search** | Search endpoint; where its results come from isn't disclosed | 1,000 credits a month | about $7.60 | Not stated | Its terms ban "commercial purposes except as expressly authorized" | Unclear | Firecrawl terms (2026-10-27) |
| **Yandex Search API** | Its own index (Russia-centric) | None found | $4 | Not stated | Terms pull in a "personal, non-commercial" licence and forbid changing result order; contracting via Serbia or Dubai entities | Unclear; poor fit | Yandex Search API terms (2026-10-27) |
| **Jina search (s.jina.ai)** | Fetches Google or Bing results (its open-source code scrapes google.com or calls Serper) | 10M tokens once | about $0.50 | Not restricted by Jina | Built on scraping Google: against Google's terms and robots.txt | Not usable | Jina reader source code (2026-10-27) |
| **SearchApi.io** | Resells scraped Google, Bing and others | 100 requests | $1–$4 | Not stated | Scrapes Google against its terms and robots.txt | Not usable | [SearchApi pricing](https://www.searchapi.io/pricing) (2026-10-27) |
| **Serper** | Resells scraped Google results | 2,500 queries, no card | $0.30–$1 | Not stated | Against Google's terms and robots.txt | Not usable | [Serper](https://serper.dev/) (2026-10-27) |
| **SerpApi** | Scrapes Google and others; sued by Google | 250 a month | $9–$25 | Not stated | Against Google's terms and robots.txt; litigation (the DMCA claims were dismissed in July 2026) | Not usable | [SerpApi pricing](https://serpapi.com/pricing), [PPC Land](https://ppc.land/google-loses-dmca-bid-to-treat-search-scraping-like-dvd-piracy/) (2026-10-27) |
| **DataForSEO** | Resells scraped Google results | $1 test credit; $50 minimum | $0.60–$2 (×5 with `site:`) | Not stated | Against Google's terms and robots.txt | Not usable | [DataForSEO pricing](https://dataforseo.com/pricing/serp/google-organic-serp-api) (2026-10-27) |
| **DuckDuckGo** | No official web-results API; results mostly from Bing | — | — | — | Nothing to license; scraping its pages breaks its terms | Not usable | DuckDuckGo help pages (2026-10-27) |
| **SearXNG** (self-hosted) | Metasearch that queries other engines' pages | Free software | Server only | Our copy, but scraped | We would be scraping Brave, Google and Bing search pages, which their robots.txt files disallow | Not usable | SearXNG docs (2026-10-27) |
| **Google Custom Search JSON API** | Google's official web search API | 100 a day, existing customers only | $5 (existing only) | — | Closed to new customers; ends 2027-01-01 | Not usable (closed) | [Google Developers](https://developers.google.com/custom-search/v1/overview) (2026-10-27) |
| **Google Vertex AI Search** | Google's suggested replacement | — | — | — | Searches up to 50 chosen domains only; full-web search is partner-only | Not usable | [Google Developers](https://developers.google.com/custom-search/v1/overview) (2026-10-26) |
| **Bing Web Search API / Grounding with Bing** | Microsoft's search | None | $14 (Grounding) | Grounding forbids storing or databases of output | The old API was retired on 2025-08-11; Grounding only works inside Microsoft's Azure agents and returns no raw results | Not usable | [The Register](https://www.theregister.com/2025/05/15/bing_search_apis_retired/), Microsoft Grounding terms (2026-10-27) |
| **Marginalia** | Small independent index of the non-commercial web | Free key, non-commercial only | Not published | Not stated | Free key is non-commercial; poor coverage of business sites | Unclear; poor fit | Marginalia API page (2026-10-27) |
| Scraping google.com directly | — | — | — | — | Google's terms forbid automated access against its robots.txt, which disallows `/search` | Not usable | [Google Terms of Service](https://policies.google.com/terms) (2026-10-26) |

### Other kinds of source

| Option | What it is | Free tier | Can we store it? | Why not | Verdict | Source (checked) |
|---|---|---|---|---|---|---|
| **Google Places API** | Official Google Maps business listings with phone and website | 1,000 detailed lookups a month | Only the place ID; not names, addresses, phones or websites | Building a stored list of contacts breaks its caching rules; $35 per 1,000 for phone and website fields | Live lookups on a center page later, not for the list | [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies) (2026-10-26) |
| **LinkedIn** | Company and people pages | — | No | Its User Agreement (§8.2) also covers data obtained through third parties such as search tools, so not even snippets are used | Link only | [LinkedIn User Agreement](https://www.linkedin.com/legal/user-agreement) (2026-10-26) |
| **Facebook, Instagram (direct)** | — | — | No | Their terms forbid automated collection | Snippets through the search API only | Meta terms (2026-10-26) |
| **Job boards (direct)** | Rozee, Mustakbil, JobStreet, Indeed, Computrabajo… | — | No | Most forbid automated access | Snippets and links only; a data feed with permission would be the biggest single gain | `src/config/domains.ts` (2026-10-26) |
| **Apollo, ZoomInfo** | Paid B2B contact databases | Apollo has a free plan; API only on custom plans | Per contract | They list "BPOs" in general, not which campaigns they run; mostly personal contact data from contributor networks, and both have faced privacy suits | Not used | [Apollo API pricing](https://docs.apollo.io/docs/api-pricing) (2026-10-27) |

Details, quotes and open questions for every row are in the research notes kept outside the repo (2026-10-26 and 2026-10-27).
