# The AI extracts facts; code decides

A language model reads job ads and websites far better than keyword rules, but it can't be trusted to judge them. In testing it read "experience in final expense preferred" in a job ad as the employer running final-expense campaigns, kept doing so after the prompt said not to, and invented red flags of its own ("age requirement") that would each have cost a center 20 points. A score that comes from the model also can't be explained or recomputed when the user changes a filter.

So the classifier, AI or keyword rules, only proposes facts, and every fact must carry a quote copied word for word from the document. Code then decides what is kept:

- The quote must really be on the page: exactly, or after normalising Unicode, quote marks, spaces and case. Quotes under 4 characters prove nothing. A website quote is traced to the page it is on.
- A campaign quote must name the campaign, with no negation in front ("we don't do Medicare"), no excluded context ("medical billing"), and, in a job ad, no experience requirement. Market and red-flag quotes must contain a matching keyword, and only the three red-flag categories count.
- The fit score is plain code over the verified evidence, with every weight in `src/config/scoring.ts`. The same checks run again when scoring, so evidence saved under older rules is judged by the current ones.

## Consequences

- A model that invents a quote or a fact loses it; dropped claims are counted and shown in each search's stats.
- The checks are cautious: a quote like "experience in sales, Obamacare campaign" is rejected too, so a real campaign can be missed rather than one invented.
- The score is reproducible and explained line by line, and filters can re-score saved results instantly without calling the model again.
- The keyword rules and any model are interchangeable behind the same checks; switching models is a settings change.
