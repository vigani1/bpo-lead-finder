# Evidence is stored, so evidence sources must allow storage

We never open job-board or social pages (their terms forbid automated access), so for a job ad or a Facebook post the search result's snippet is the evidence itself: "Reliant BPO is hiring Final Expense closers…". We decided to store that evidence, which means the search API it comes from must allow keeping its results. Most don't: Brave, Parallel, Linkup, Kagi, Valyu and Exa allow only transient use (`docs/sources.md` has each clause). So evidence comes from Tavily, whose terms allow storage, and transient-only sources are used just to find company websites, which we then fetch and read ourselves; what we store from those comes from our own reading.

## Considered: run live and store nothing

Technically the tool could search, show the results, and discard them, which would let transient-only providers supply evidence too. We rejected it because:

- Results would vanish when the page closes: no recent searches, no center pages to come back to, no list that grows as searches reuse the centers earlier ones found.
- Changing a filter (evidence age, confidence) would need a new 30–60-second paid search instead of re-scoring saved evidence.
- The score's recency rule needs to know when each piece of evidence was seen.
- Some terms limit showing results, not just storing them (Exa §4.2(a)), and the CSV export is itself a stored copy.

## Consequences

- Adding an evidence source means first checking that its terms allow storing results. Of the options checked on 2026-10-27, only Mojeek's Business plan does.
- Transient-only providers can still widen website discovery, as Exa does, at no risk to the terms.
