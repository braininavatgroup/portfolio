# Portfolio intelligence dashboard design

## Status

Approved in conversation by Bradley on 2026-09-11. This design extends the
approved privacy-safe portfolio insights contract from 2026-09-03. It keeps
production identity pseudonymous and resolves assigned recipients only in a
private dashboard on Bradley's Mac.

The approved scope includes implementation, the required Airtable schema
change, deployment, and activation. Those remain separately provable changes
even though this Bradley-started session authorizes the complete delivery.

## Outcome

Replace the current traffic-oriented report with a local decision dashboard
that answers:

1. Which assigned portfolio links have activity?
2. What did those sessions read and do?
3. Which stories and evidence hold attention or lead to contact?
4. Which sources, cities, regions, and devices bring useful traffic?
5. Which heatmaps or recordings should Bradley inspect in Clarity?

The dashboard must be useful without an agent interpreting it. It leads with
changes and decisions, not analytics vocabulary or infrastructure totals.

## Attribution language

A campaign code identifies the Airtable Action a link was assigned to. It does
not authenticate the person who opened the link. A recipient can forward a
link, open it through a security scanner, or use it on a shared device.

The dashboard therefore says:

- "Activity from Alex's assigned link"
- "Assigned company"
- "Link sessions"

It never says "Alex visited" or "Alex read this". This wording is a product
contract, not a disclaimer hidden in documentation.

## Chosen architecture

The system combines four sources, each for the job it can support reliably.

| Source | Owns | Does not own |
| --- | --- | --- |
| Microsoft Clarity | Human sessions, masked recordings, click maps, scroll maps, attention maps, frustration signals | Recipient names, durable custom-event export, local outcome data |
| Cloudflare Web Analytics | Aggregate browser visits and Web Vitals | City-level human behavior, recipient attribution |
| Cloudflare Analytics Engine | Structured portfolio actions, anonymous tab sessions, campaign codes, approximate edge geography | Names, companies, job stages, recordings, DOM content |
| Airtable `Job Search` | Link assignments, people, jobs, companies, pipeline state and outcomes | Behavioral events |

`npm run insights` reads the three remote sources and joins them locally. The
generated HTML and source snapshots remain under
`~/Library/Application Support/biv/portfolio-insights/`. They are never served
by the portfolio, committed, or uploaded.

Clarity remains the viewer for heatmaps and recordings because its Data Export
API does not export them. The local dashboard supplies allowlisted links into
the relevant Clarity project and saved filters. It does not scrape Clarity or
implement a second replay recorder.

## Event contract

The dormant first-party sink on `insight-event-sink` is the base. It already
accepts eligible `portfolio_*` events and stores action, content, campaign,
country, device, attention, evidence, and contact dimensions.

The event contract gains four fields:

| Field | Source | Purpose |
| --- | --- | --- |
| `session_id` | Random value generated once per browser tab and held in `sessionStorage` | Orders events into one anonymous journey |
| `region_code` | `request.cf.regionCode` | First-level geographic grouping |
| `city` | `request.cf.city` | Approximate city grouping |
| `metro_code` | `request.cf.metroCode` when present | Optional metro grouping |

The sink does not store IP addresses, user-agent strings, latitude, longitude,
postal codes, referrers, prose, email addresses, names, company names, job
titles, or Airtable record IDs. City is the most specific retained geography.
IP-derived geography is approximate and may reflect a VPN, mobile gateway, or
corporate network.

The session ID is random, carries no meaning, and ends with the tab. It is not
a cookie or a cross-device identifier. Existing analytics eligibility and
`analytics=off` behavior apply to both Clarity and the first-party beacon.

## Airtable contract

The production authority is the `Job Search` base `app0LM9NfGL4ZHi3j` in the
`The Brain` workspace. PR #9 changed its live model to Actions, Jobs, People,
Companies, and Sources. This design uses that v2 model and does not revive the
retired Applications table.

An assigned portfolio link is one Airtable Action linked to its Person and,
when known, Job and Company. Add these fields to Actions:

| Field | Type | Rule |
| --- | --- | --- |
| `Portfolio Campaign Code` | Single-line text | Unique, random, lowercase code matching `[a-z0-9][a-z0-9_-]{5,63}` |
| `Portfolio Link Sent` | Date and time | When this assigned link was sent |
| `Portfolio Link Channel` | Single select | `Email`, `LinkedIn`, `Application`, `Referral`, `Other` |
| `Portfolio URL` | URL | Canonical portfolio URL carrying the campaign code |

The existing Action links resolve Person, Job, Company, and pipeline context.
One Action represents one link assignment, so one job can have multiple
recipients and one person can receive more than one link without ambiguous
codes. A completed send Action remains available in Action history and keeps
the mapping intact.

The local reader uses a named, read-only Airtable credential scoped to this
base. It requests only the fields required for the dashboard. It never updates
Airtable during a report run. Schema creation is a one-time migration and is
not delegated to the unattended morning job.

An unmapped campaign code remains anonymous and is reported as a neutral note,
not an error. A mapped Action without a Person is shown as unassigned outreach.
Duplicate non-empty codes fail the join and appear as a configuration error.
They are never assigned by guessing.

## Local storage and privacy

The insight directory is mode `0700`; files containing Airtable data are mode
`0600`. The dashboard is self-contained and makes no background network
requests. External navigation occurs only after Bradley clicks an allowlisted
Clarity or Airtable link.

Raw journey snapshots remain local for 180 days. A scheduled run removes older
raw journeys after it has written aggregate content, geography, and campaign
history. Aggregate history can remain indefinitely because it contains no
names or event-level sequences. Airtable remains the authority for identity
and outcomes.

The generator escapes every Airtable and analytics string before writing HTML.
It accepts external links only for the configured Airtable base and Microsoft
Clarity project. A bad source must render as unavailable, never as zero.

## Source freshness

Each source has a separate last-known-good snapshot and timestamp. A Clarity
quota error, Airtable outage, or Cloudflare query failure cannot erase data
successfully collected earlier that day.

Every dashboard section shows its source window and freshness. Stale data is
marked explicitly. Comparisons never combine unlike windows without naming
both windows. Clarity sessions and Cloudflare visits remain separate measures.

## Dashboard information design

The dashboard remains a local supporting page rather than part of the public
portfolio composition. It uses the supporting-page conventions already
present in the dashboard generator and does not introduce public application
tokens or components.

### What changed

The first screen shows only items Bradley may act on:

- newly active assigned links;
- repeat link activity;
- evidence or contact actions;
- content with a material change in hold or advance signals;
- new geographic concentrations;
- frustration, server-error, or performance regressions.

Crawler counts and infrastructure totals move to a collapsed diagnostics
section.

### Assigned links

One row per mapped Airtable Action shows recipient, company, job, job stage,
sent time, latest activity, link sessions, content opened, evidence opened,
contact actions, and outcome. Expanding a row shows journeys ordered by
session and event timestamp.

### Content resonance

One row per portfolio record or thread shows:

- eligible sessions that opened it;
- median active seconds;
- median maximum completion;
- evidence-open rate;
- contact-action rate;
- common entry source and next content;
- assigned-link and anonymous shares.

There is no opaque resonance score. The dashboard prints raw measures and a
deterministic comparison sentence only when at least five eligible sessions
support it. Smaller samples show counts and "not enough data for a pattern."

### Journeys

The aggregate view shows common entry points, content transitions, exits, and
paths that reach evidence or contact. The assigned-link view shows individual
anonymous tab sessions under the Airtable link assignment. Direct traffic
stays anonymous.

### Audience

The audience view shows source, device, and approximate country, region, city,
and metro. Clarity drives the human location view in its UI. Analytics Engine
supplies exportable city-level event data for the local report. Cloudflare Web
Analytics country totals remain a diagnostic comparison because they include
traffic the human report excludes. The local report does not claim new versus
returning visitors because none of its exportable sources provides a reliable
cross-session human identifier.

Geographic labels never imply physical presence or residence. City and region
mean "network location reported for this request."

### Observe in Clarity

Content and geography rows provide controls for:

- click map;
- scroll map;
- attention map;
- matching recordings.

The implementation first verifies which Clarity filters survive in a shared or
saved URL. When a full pre-filtered URL is unsupported, the control opens the
project and displays the exact campaign code, content ID, city, and filter
steps. It does not depend on undocumented query parameters.

## Deterministic findings

Findings are generated from declared comparisons, not an LLM. Examples include:

- a story's evidence-open rate changed materially against its prior complete
  window;
- an assigned link returned after at least 24 hours;
- a city produced at least five eligible sessions and was absent in the prior
  window;
- a content item has strong completion but weak evidence opening;
- a path reaches contact more often than the site's baseline.

Every finding names its count, denominator, window, and comparison. Missing or
small data produces no conclusion.

## Failure behavior

- Clarity `429`: use its last-known-good snapshot and show the timestamp.
- Airtable unavailable: render anonymous analytics and mark identity resolution
  unavailable.
- Analytics Engine unavailable or not activated: render existing Clarity and
  Cloudflare sections and name the missing capability.
- Unknown campaign code: keep activity anonymous and show a neutral note naming
  the code. A code with no Action is normally an old, retired, or forwarded
  link, not a misconfiguration.
- Duplicate or malformed campaign code, or a linked field carrying more than
  one record: keep activity unattributed and show a configuration error.
- Missing city or region: group as `Unknown`; do not infer from timezone or
  language.
- Malformed event: answer `204` without writing, preserving the sink's
  non-enumerating response.
- Empty period: show a valid empty state, not an error and not a fabricated
  trend.

## Delivery slices

1. Merge `analyze-portfolio-traffic` (PR #5), the dashboard and history base.
2. Extend `insight-event-sink` (PR #6) with session and city-level geography,
   preserving its false production gate.
3. Land a tested Airtable read adapter, source snapshots, retention, and local
   campaign join.
4. Add assigned-link, content, journey, audience, and diagnostics renderers.
5. Verify and add Clarity heatmap and recording navigation.
6. Add the four Action fields through an idempotent Job Search schema migration
   and update that repository's v2 schema docs.
7. Review the `/privacy` copy against the final fields and retention.
8. Deploy one immutable candidate, activate the Analytics Engine gate, and run
   a controlled campaign-link smoke test.
9. Update the canonical clone and scheduled job, then verify the next morning's
   source freshness and local dashboard permissions.

The code slices may use stacked pull requests, but activation occurs only from
a combined head that has passed the affected checks.

## Verification contract

Test-first work protects these seams:

| Proof owner | Failure protected against | Retirement condition |
| --- | --- | --- |
| Analytics adapter tests | Session IDs persist across events in one tab but not across new tabs; opt-out emits nothing | The browser analytics adapter is removed |
| Sink contract tests | Identity, exact coordinates, postal codes, IPs, and unbounded values cannot be written | The first-party sink is removed |
| Airtable adapter tests | Reports are read-only, fields are projected, duplicate codes fail closed | Airtable stops owning campaign assignments |
| Journey reducer tests | Events are grouped and ordered by session without merging recipients or anonymous traffic | Journey reporting is removed |
| Resonance tests | Rates use correct denominators and small samples produce no claim | Content comparison is removed |
| Snapshot tests | A failed source cannot overwrite its last-known-good data | The dashboard stops combining remote sources |
| HTML safety tests | Airtable content is escaped and links are allowlisted | Airtable data is no longer rendered |
| Rendered dashboard tests | Decision sections, empty states, freshness, and drilldowns work at desktop and mobile widths | The HTML dashboard is replaced |
| Worker configuration tests | The sensitive sink cannot activate in an unreviewed config | The gate is replaced by an equivalent reviewed control |

Pull-request proof runs focused tests, typecheck, lint, the full unit suite, and
the rendered build suite. The dashboard gets managed Playwright proof at
1440 by 900 and 390 by 844 in light and dark. Production proof verifies the
exact deployed commit, one controlled assigned link, Analytics Engine rows,
the local Airtable join, source timestamps, and rollback by returning the gate
to `off`.

## Documentation changes

Implementation updates:

- `docs/portfolio-insights-operations.md` with the source contract, attribution
  language, freshness, retention, Clarity navigation, and recovery steps;
- the Job Search repository's v2 Airtable schema notes with the four Action
  fields and migration record;
- `/privacy` through the copy-deck workflow before activation.

The earlier privacy-safe design remains the authority for eligibility,
attention accounting, navigation ownership, and chat exclusion. This design
supersedes only its exclusion of an analytics database and identity resolution.
The new storage exists because the implemented Clarity export cannot answer
the approved journey and recipient questions.

## Explicit exclusions

- No names, companies, titles, Airtable IDs, postal codes, or coordinates in
  production analytics.
- No claim that an assigned recipient personally opened a link.
- No browser fingerprint, cross-device identity, IP retention, or hidden login.
- No custom session-replay or heatmap recorder.
- No Clarity scraping or dependence on undocumented URLs.
- No Airtable writes from the daily report.
- No public or remotely hosted private dashboard.
- No LLM-generated findings in the unattended job.

## Reference basis

- [Clarity Region Insights](https://learn.microsoft.com/en-us/clarity/insights/region-insights)
  confirms country, state, and city drilldowns plus geographic heatmap and
  recording filters.
- [Clarity Data Export API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api)
  defines the three-day window, ten-request daily quota, and exportable
  dimensions. It does not export recordings, heatmaps, or custom events.
- [Cloudflare Web Analytics dimensions](https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/)
  lists country as its geographic dimension.
- [Cloudflare Workers Request](https://developers.cloudflare.com/workers/runtime-apis/request/)
  defines the city, region, region code, and metro code fields available on
  inbound `request.cf` metadata.
