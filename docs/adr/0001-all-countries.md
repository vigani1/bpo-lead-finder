# Every country is searchable; six are tuned

The feasibility check tested six countries by hand (Pakistan, the Philippines, India, Colombia, Mexico, the Dominican Republic) and found call-center cities, local job-ad words and very different amounts of public data for each. Offering only those six would hide centers anywhere else, and hand-tuning all 243 countries isn't worth it: most have no centers running US insurance campaigns.

So every country libphonenumber knows is selectable. The six tuned countries keep their hand-made settings in `src/config/countries.ts`. The other 237 get settings derived in `src/lib/all-countries.ts`: phone prefix, domain ending (none for endings sold worldwide, like .io or .tv), the country's main time zone (from Node's Intl data, with overrides for big countries such as the US and Brazil), and Spanish search terms for Spanish-speaking countries. They have no cities, no hiring words and no tested coverage, and the search form says so.

A center's location comes from several signals: phone prefix, domain ending, city, the job board's country and the page text. US and Canadian (+1) numbers never count as a location, because offshore centers often show a virtual +1 number so American clients can call them.

## Consequences

- Searches in untuned countries are thinner. Tuning one more country means adding an entry to `src/config/countries.ts`; nothing else changes.
- The US is selectable, but US centers can only be placed by their domain ending and text, never by their phone numbers.
