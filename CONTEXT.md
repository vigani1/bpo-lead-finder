# Call Center Lead Finder

Finds offshore and nearshore call centers that run US insurance campaigns, and shows the public evidence behind every match. These are the words the code, the UI and the docs share.

## Searching

**Search**:
One run of the tool for a set of filters: a campaign, a country, a market and a depth.
_Avoid_: Query, job, scan

**Campaign**:
The US insurance product a center sells or supports on behalf of a client: Medicare, ACA (Obamacare), final expense or life insurance.
_Avoid_: Vertical, product line

**Market**:
Which US consumers a campaign serves: English, Spanish (US Hispanic) or bilingual. It describes the campaign, never the center's location.
_Avoid_: Language (for the center), region

**Country**:
Where a center's floor is located. A search's country filter may be "any".
_Avoid_: Location, region, market

**Tuned country**:
One of the six countries (Pakistan, the Philippines, India, Colombia, Mexico, the Dominican Republic) with hand-made search settings and tested coverage. Every other country is supported with derived settings.
_Avoid_: Supported country, main country

**Coverage**:
How much public data was found for a tuned country and campaign in testing: strong, workable, weak or none.

**Depth**:
How much a search is allowed to spend: quick or thorough.
_Avoid_: Mode, level

**Query**:
One request sent to a source while running a search.

**Source**:
A search index the tool discovers pages through. A **storable** source's results may be kept as evidence; a **transient** source's results are only used to find company websites.
_Avoid_: Provider, engine

**Hit**:
One result returned by a source for a query: a URL, a title and a snippet.
_Avoid_: Result (reserved for a center in a search's results), match

**Snippet**:
The short excerpt a source returns with a hit. For sites that may not be fetched, the snippet is all that is read.

**Ruled out**:
A hit that was looked at and dropped, kept with the reason so the user can see what was not counted.
_Avoid_: Rejected, filtered, excluded

## Centers and evidence

**Center**:
A company that runs calls for clients: one record per company, whatever the number of pages it was found on.
_Avoid_: Lead, company, vendor, BPO (except in copy)

**Entity type**:
What kind of organisation a page is about: a call center, a freelancer, a staffing agency, a US insurance agency, a lead marketplace, a campaign buyer or something else. Only call centers become results.

**Campaign buyer**:
A company on the other side of the deal: it buys leads or calls from call centers, or hands campaigns to them. It is ruled out, never a result.
_Avoid_: Lead buyer, broker (as separate terms)

**Evidence**:
One fact about a center, backed by a quote from a page and the page's URL.
_Avoid_: Signal (for stored facts), proof (for single facts)

**Quote**:
The exact words on a page that support a piece of evidence. A fact without a quote that is really on the page is not evidence.
_Avoid_: Excerpt, citation

**Claim**:
A fact a classifier proposes, with its quote, before the quote has been checked. Verified claims become evidence; the rest are dropped.

**Classifier**:
What reads a page and proposes claims: an AI model or the keyword rules.

**Campaign proof**:
The evidence that a center runs the requested campaign. A **job ad** naming the center is the strongest kind, a service page on the center's **own site** comes next, and anything else is a **mention**.

**Campaign role**:
What the center does on a campaign: sales, live transfers, appointment setting or customer service.

**Job ad**:
A posting by one employer for one job. A job board page listing many employers is not a job ad for any of them.

**Red flag**:
Evidence that a center is a poor partner: resold or shared transfers, benefit bait, or high-risk campaigns.

**Compliance language**:
Evidence that a center follows US calling rules or proves consent, such as TCPA, DNC scrubbing or call recording.

**US hours**:
Evidence that a center works US calling hours, such as a night shift.

**Merge**:
Attaching evidence found on a new page to a center that is already known, because it is the same company.
_Avoid_: Dedupe, link

## Results

**Result**:
A center in a search's results, with its fit score and label.

**Fit score**:
How well a center matches a search's filters, from 0 to 100, computed from its evidence.
_Avoid_: Rating, rank

**Confidence**:
The label a fit score falls into: High, Medium or Low. High also needs a job ad or own-site campaign proof.
_Avoid_: Quality, tier

**Feedback**:
A user's verdict on a center for a search: fit or not fit.
