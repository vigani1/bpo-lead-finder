# Duplicates merge by domain, then phone, then a similar name

The same call center turns up many times in one search: several job ads that name it differently ("Prime BPO", "Prime BPO (Pvt.) Ltd"), its website, a Facebook page. Most centers have no website, so the domain alone can't join them. But a wrong merge is worse than a missed one: it hands one company's evidence to another, and two companies can share a name ("Prime BPO" in Lahore is not "Prime BPO" in Rawalpindi).

So a new observation is matched to a known center by the strongest key it has, in order (`src/lib/resolve/resolve-center.ts`):

1. **Same registered domain.**
2. **Same phone number**, but only if exactly one center has it: a number shared by several is a directory or tracking line.
3. **Similar name**, after removing legal forms and filler words ("Pvt Ltd", "BPO", "Solutions"), measured with Postgres trigram similarity: at least 0.6, or 0.8 when the shorter name has 7 letters or fewer, so "Prime" and "Prime III" don't merge on name alone. A different city or country blocks the merge. A merely similar name also needs the same city or country; a near-identical one (0.95) doesn't.

Merging only adds information: a known value is never replaced by an unknown one, and a name from the company's own website beats one parsed from a job-ad title. Every piece of evidence records which rule attached it to its center.

## Consequences

- A center whose job ads spell its name differently and give no phone or city can stay split in two. That is the accepted side of the trade-off.
- Resolution runs one document at a time within a search, so two documents about a new center can't both create it.
- Both databases need the `pg_trgm` extension for the similarity measure and its index.
