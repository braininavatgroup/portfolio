# Portfolio insights operations

This runbook keeps the external visitor dataset useful without treating
Bradley's devices, preview reviews, campaign identities, or crawler requests
as visitor outcomes.

## Exclude a Bradley-controlled browser

Before using the public portfolio from a browser profile, open:

```text
https://bradleyberkman.com/?analytics=off
```

The page stores an analytics opt-out before Clarity can start and removes the
parameter from the address bar. Repeat this once for every browser profile and
device Bradley controls, and repeat it after clearing site storage. Private
browsing windows need their own enrollment each time because their storage is
temporary.

Verify the exclusion in browser developer tools:

1. The page URL no longer contains `analytics=off`.
2. The document contains no `script[data-portfolio-replay]` element.
3. The Network panel contains no request to `clarity.ms/tag` or a Clarity
   collection endpoint.
4. `/privacy` offers **Enable Clarity analytics**, which confirms the stored
   preference is denied.

Re-enabling analytics on `/privacy` changes the stored preference. It takes
effect on the next page load: the excluded page has no Clarity runtime to
notify, so the next eligible load forwards the saved `granted` to Clarity's
consent API itself. A document that is not eligible — the `preview` marker, a
missing marker, a non-public hostname — ignores the saved preference entirely
and stays dormant.

## Use assigned job-search links

Every link Bradley sends directly gets its own opaque code, stored on one
Action in the Airtable `Job Search` base (`app0LM9NfGL4ZHi3j`). Actions have
carried four portfolio fields since 2026-09-11T20:07Z (job-search PR #11):

| Field | Holds |
| --- | --- |
| `Portfolio Campaign Code` | The code: random, lowercase, `[a-z0-9][a-z0-9_-]{5,63}`, unique across Actions |
| `Portfolio Link Sent` | When the link went out |
| `Portfolio Link Channel` | `Email`, `LinkedIn`, `Application`, `Referral`, or `Other` |
| `Portfolio URL` | The portfolio URL carrying `?campaign=<code>` |

Generate the code with `openssl rand -hex 8`. Never use a company name,
person's name, email address, job title, or recognizable abbreviation. One
Action is one link, so two recipients for the same job get two codes. The
Action's own links to Person, Job, and Company supply the context, and
Airtable stays the only place the code is *stored* beside a name or an
outcome.

Until BIV-527 that was a stronger claim: the join ran only on Bradley's Mac,
so Airtable was the only place the two ever met. Bradley decided on
2026-09-18 that a laptop-resident privacy boundary was not worth its cost and
accepted a logical one instead. The scheduled Worker now reads the same
read-only Airtable projection and renders the joined dashboard at the edge,
where it is kept in a private R2 bucket and served only through Cloudflare
Access — the control already guarding `canvas.braininavat.dance` and
`studio.braininavat.dance`. Production still stores nothing but the opaque
code; what changed is that the dashboard built from it now lives somewhere
other than one laptop.

The browser removes the parameter from the visible URL, keeps it for the
current tab, and adds it to later portfolio insight signals. Clarity and the
Analytics Engine row see only the code. The name is joined to it only in the
report (see [Assigned-link attribution](#assigned-link-attribution)).

## Read the signals

Use the dashboard for portfolio actions: entries, content opens and
their selection source, active Reader time, maximum Reader completion,
evidence opens, Guide evidence navigation, and contact-action kinds. It reads
them from the first-party sink as anonymous tab journeys and joins them to
assigned links, so until the sink is activated those sections say
unavailable. Use Clarity for what only Clarity records: masked recordings and
click, scroll, and attention heatmaps (see [Observe in
Clarity](#observe-in-clarity)). Treat Draw, Hold, and Advance as working
analysis lenses, not permanent product categories.

Use Cloudflare analytics for aggregate edge traffic, request geography,
status, bots, and crawler access. Cloudflare requests and Clarity sessions
have different eligibility and counting rules, so their totals are not
expected to match.

An AI crawler request proves only that a crawler accessed a URL. It does not
prove that an AI answer used or cited the portfolio. Citation evidence needs a
separate, reproducible answer check or citation monitor with its own approval,
data policy, and operating record. No such monitor is activated by this work.

## Read them from the terminal

```sh
npm run setup:insights      # once, per machine: mint and store the three tokens
npm run insights            # last 7 days of Cloudflare, last 3 of Clarity
npm run insights -- --history   # one row per past run, oldest first
npm run insights -- --no-airtable   # render without assigned-link identity
npm run insights:dashboard  # open the dashboard rebuilt from what is on disk
npm run test:insights       # every insights test, no network or token
```

The terminal report opens with the dashboard's own **What changed**: each
source's freshness, any Airtable configuration error, the row-cap warning, and
the findings with their counts and windows. The traffic detail follows.

### The dashboard

Every run that records a snapshot also rewrites `dashboard.html` beside the
history: one self-contained page, no scripts or network, built to be read at a
glance before it is read in full.

It opens with two strips. The **freshness strip** names all four sources once,
with each one's window, its state, and why it is not fresh; a section below
then carries only a short badge per source (`Fresh 16:00`, `Stale 09-10 07:10`,
`Unavailable`) and repeats a reason only when that source is not fresh, so a
healthy run shows no grey text under its headings. The **decision strip**
leads with the counts worth acting on — assigned links active, link sessions,
content opens, evidence opens, contact actions — each with its change against
the previous run and a sparkline, wherever the aggregate history supports one.
Assigned-link measures carry no trend on purpose: history keeps no campaign
codes, so nothing about one link survives a run.

Below that, content rows carry their own trend mark of sessions per run, the
Clarity filter steps are printed once for the whole section rather than under
every row, and `not enough data for a pattern` is said at most once per
section. Crawler counts, infrastructure totals, and the per-run curve stay in
the collapsed Diagnostics section. Charts are inline SVG with no scripts, so
there is no hover or tooltip channel: every value is direct-labelled, carried
in the mark's accessible label, or reachable in a table view. Each chart has a
table view and works in light and dark.
`npm run insights -- --dashboard` opens it after a live run;
`npm run insights:dashboard` opens it without spending any API budget. The
scheduled run keeps the copy under
`~/Library/Application Support/biv/portfolio-insights/dashboard.html`
current every morning, so that file is the thing to bookmark.

The report opens with **believable humans**: Clarity human sessions minus
localhost referrals, and Cloudflare visits minus the preview login page,
localhost referrals, and headless browsers. Those are the closest either
source gets to "people who are not Bradley, a reviewer, or a test run".
Cloudflare RUM has no opt-out, so its believable number still contains
Bradley's own devices; Clarity's does not, because those browsers are
enrolled with `?analytics=off`.

A **daily trend** table follows the Cloudflare headline with pageloads,
visits, and edge requests per day, and the web vitals are broken out per
device class so a slow p95 can be placed.

`npm run setup:insights` walks through minting a Cloudflare API token and a
Clarity Data Export token and stores each in the macOS login Keychain under
`biv-portfolio-insights`. Neither token can be minted by a script — Cloudflare
refuses to let an API token create another API token, and Clarity has no token
API — so both come from a dashboard. `CLOUDFLARE_API_TOKEN` and
`CLARITY_API_TOKEN` in the environment override the stored ones. The script
also reads the older hand-made entry `biv-cloudflare-analytics / api-token`,
so a Cloudflare token stored there before `setup:insights` existed keeps
working without being copied.

Every token reaches the Keychain on standard input, through
`scripts/store-keychain-secret.swift`, and never as a command-line argument:
an argument vector is readable by any process running as the same user, and
`ps` would have shown the token for as long as the call took. The same is true
of the verification requests, which build the `Authorization` header with
`printf` and hand it to `curl` on stdin with `-H @-`.

Storing is delete-then-create. Each item's access controls name exactly one
trusted program, `/usr/bin/security`, which is how the report and the
read-back check are able to read the value. That also makes `security` the
only thing that can remove the item without macOS asking for an
authorization, and macOS asks with a password dialog. So `setup:insights`
deletes any existing entry with `security delete-generic-password` — which
carries no secret on its command line and does nothing when the entry is
absent — and then the writer creates a fresh item with fresh access controls.
Re-running therefore replaces whichever token you paste, leaves the others
alone, and never prompts.

The consequence of deleting first is that a write which fails leaves nothing
stored for that one account. The setup says so and asks you to paste it again;
the other two tokens are untouched.

The writer can also update an existing item in place, and does when it is
called directly without a prior delete. That path depends on the item's
existing access controls permitting it, so the setup scripts do not rely on
it.

The toolchain is required, not optional: without `xcrun swift` the setup stops
with an explicit message rather than storing a token the exposed way.

Stage 3 stores a read-only Airtable token for the assigned-link join. Mint a
personal access token at `https://airtable.com/create/tokens` with only the
`data.records:read` scope and access to only the `Job Search` base. The setup
verifies the token before storing it in Keychain as service
`biv-portfolio-insights`, account `airtable-read-token`, and refuses the admin
`AIRTABLE_API_TOKEN`. `PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN` in the environment
overrides the stored one. The report never writes to Airtable. Without a
token it renders anonymous analytics and marks identity resolution
unavailable.

The Cloudflare token needs **two** permission rows, because they answer
different questions:

| Permission | Answers |
| --- | --- |
| Account · Account Analytics · Read | Web Analytics: what browsers did |
| Zone · Zone Analytics · Read | Edge requests: what every client asked for, including crawlers that run no JavaScript |

A token with only the first still produces a report; the edge and crawler
section says so instead of silently reading as zero.

### What the numbers mean

Cloudflare counts a **pageload beacon**. The portfolio is a single-page app, so
one person reading one page fires many: in a typical week over 90% of beacons
are `routing-apis` or `soft-navigation` in-app route changes. **Visits** — the
subset whose referrer is outside the site — is the honest Cloudflare number,
and `npm run insights` leads with it. Cloudflare RUM has no opt-out, so the
`?analytics=off` enrollment above excludes a browser from Clarity but not from
these counts.

Clarity counts a **session** of an eligible visitor and buckets bot sessions
separately. The two totals are not expected to match and are never added.
Clarity's count is the larger and the more honest one for humans: Cloudflare
visits drop every entry whose referrer is the site itself, and its adaptive
sampling drops small referrers entirely, so a LinkedIn share can show 15
Cloudflare visits and 130 Clarity sessions in the same window.

The report also breaks Clarity sessions down by source and channel, by page
with click and campaign parameters stripped, and by device, and shows average
engagement time and scroll depth. Frustration signals are shown as the
metric's own count and the share of sessions that had one; they are read from
the project-wide row only, never summed across the dimension rows, which
repeat the project total once per requested breakdown.

Cloudflare samples adaptively, and it samples harder over a wider window: at
`--days 10` the counts round to the nearest ten and a referrer worth nine
pageloads disappears entirely, while the same query at `--days 7` shows it. When
the question is *did anyone arrive from outside*, ask a narrow window.

### Crawlers, scanners, and status codes

With Zone Analytics Read the report adds a section that splits edge requests
by user agent into **browsers**, **named crawlers** (GPTBot, OAI-SearchBot,
ClaudeBot, Googlebot, link-preview fetchers and the rest), and **automation**
(headless Chrome, Go and Python HTTP clients, curl, and user agents that are
themselves a URL). It then counts **vulnerability probes** by path — requests
to WordPress, PHP, dotfile and admin-panel paths this site has never had — and
buckets response status, listing every path that returned a 5xx.

Read it with three caveats:

- Cloudflare's free plan answers the per-user-agent dataset one UTC day at a
  time and returns only the top rows of each day, so the script asks once per
  day and the long tail of rare agents is not counted in any bucket.
- The browser bucket still contains Bradley's own devices, reviewers, and the
  preview login page. It is an upper bound on humans, not a count.
- A 5xx here says only that the edge returned it. The cause is in the Workers
  Logs for `bradley-portfolio-main-preview` in the Cloudflare dashboard, which
  the deployed worker keeps because observability is enabled in
  `wrangler.main-preview.jsonc`.

### What the export API cannot answer

The Clarity Data Export API breaks down by Browser, Device, Country/Region, OS,
Source, Medium, Campaign, Channel and URL only. The portfolio's own signals —
Reader active time, Reader completion, evidence opens, Guide navigation,
contact-action kinds — are custom Clarity events (`portfolio_*`) with no export
dimension. The same events also go to the first-party sink below, and the
local report reads them from there.

`campaign=<code>` is stored as the custom tag `portfolio_campaign`, not as
`utm_campaign`, so it does not reach the export API's Campaign dimension
either. The report takes the code from the sink's `blob4` and joins it to
Airtable locally. In Clarity it remains a filter value (see [Observe in
Clarity](#observe-in-clarity)).

### The scheduled run

The run is a cron trigger on the `bradley-portfolio-main-preview` Worker —
`triggers.crons` in `wrangler.main-preview.jsonc`, `10 11 * * *` UTC. It calls
the same `runInsights` the CLI calls, from the same modules, with its records
in the private R2 bucket `biv-portfolio-insights` under the `runs/` prefix and
its three read-only tokens as Worker secrets. Cron triggers are UTC only, so
the run drifts an hour against local clocks across daylight saving; nothing
downstream reads the hour.

Read the result at **<https://insights.braininavat.dance>**, behind Cloudflare
Access. The Worker verifies the Access assertion itself — signature, audience,
expiry, and identity — rather than trusting that the edge applied the gate,
because the same Worker also answers on `workers.dev` and on the portfolio's
own hostnames, which no Access application covers. A hostname configured
without its team, audience or allowed identity serves nothing at all.

Nothing about the run is installed on a machine. The launchd job
`com.biv.portfolio-insights` and its installer were retired in BIV-527;
`npm run insights` is now a manual read, not the thing that keeps history
going. If that agent turns up still installed somewhere — it would spend 4 of
Clarity's 10 daily requests alongside the Worker's 4 — unload it by hand, since
the installer that knew how to is gone:

```sh
launchctl bootout "gui/$(id -u)/com.biv.portfolio-insights"
rm -f ~/Library/LaunchAgents/com.biv.portfolio-insights.plist
```

### What a deploy expects to already exist

`wrangler.main-preview.jsonc` names four things the deploy does not create. A
missing one fails the whole portfolio deploy, not just the dashboard, so
provision them before the first candidate that carries this config:

| Thing | Create it with |
| --- | --- |
| R2 bucket `biv-portfolio-insights` | `wrangler r2 bucket create biv-portfolio-insights`. Give it no public `r2.dev` URL and no custom domain — the Worker's Access gate would stop being the only way in |
| DNS record for `insights.braininavat.dance` | A proxied record on zone `braininavat.dance`, landing with its Access application so the hostname is never briefly public |
| Cloudflare Access application on that hostname | Self-hosted, allow `bradley@braininavat.dance`. Its audience tag becomes `PORTFOLIO_INSIGHTS_ACCESS_AUD` |
| The four Worker secrets | `wrangler secret put`, as above |

The deploy credential also needs `Workers Routes: Edit` on `braininavat.dance`,
not only on `bradleyberkman.com`: the Worker now has a route on both zones, and
a token scoped to one fails on the other.

Set or rotate the Worker's tokens with `wrangler secret put <NAME> --config
wrangler.main-preview.jsonc`: `CLOUDFLARE_API_TOKEN` (Account Analytics Read
plus Zone Analytics Read), `CLARITY_API_TOKEN`,
`PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN`, and `PORTFOLIO_INSIGHTS_ACCESS_AUD`, the
Access application's audience tag. `npm run setup:insights` still mints the
same three tokens into the login Keychain for local runs; the Worker does not
read them.

The first-party sink below exists to close exactly this gap. Until it is
activated, the report marks those sections unavailable rather than printing
zeros, and the signals can be read only in Clarity.

### The first-party sink (dormant)

The worker has a second sink for the same `portfolio_*` events: a Workers
Analytics Engine dataset it writes itself, which the SQL API can read from the
terminal. It ships **dormant** and nothing about it changes live behaviour
until the gate below is flipped in a deployed candidate.

**How it flows.** `trackPortfolioInsight` in `lib/portfolio-analytics.ts`
decides eligibility once — the `external` document marker, the public
hostname, and the stored analytics preference — and only then sends the
validated event to Clarity *and* posts the same `{ action, dimensions }` body, plus the tab's `session_id`,
to `POST /api/portfolio-insight` with `navigator.sendBeacon` (keepalive
`fetch` as the fallback). A visit Clarity would not hear from never reaches
the worker either; the `?analytics=off` enrollment excludes a browser from
both. The route (`app/api/portfolio-insight/route.ts`,
`lib/server/portfolio-insight-sink.ts`) re-validates the body with the same
rules, caps it at 2 KB and 8 dimensions, throttles by a hashed connecting
address through the `PORTFOLIO_INSIGHT_RATE_LIMITER` binding, and answers 204
whether it wrote, rejected, or is dormant, so the response never says which.

**The gate.** `PORTFOLIO_INSIGHT_EVENTS_SINK` in `wrangler.main-preview.jsonc`
is `"off"`. The worker writes only when it is exactly `"analytics-engine"` and
the `PORTFOLIO_INSIGHTS` dataset binding (`portfolio_insights`) is present.
Any other value, including a missing variable, is dormant;
`tests/main-preview-worker-config.test.mjs` fails if the committed value is
ever the live one. Dormant, the endpoint still answers 204 and reads nothing.

**What one row holds.** Fixed positions, empty string when a dimension is
absent:

| Column | Value |
| --- | --- |
| `blob1` | action (`entry`, `content_open`, `content_attention`, `evidence_open`, `guide_evidence`, `contact_action`) |
| `blob2` / `blob3` | `content_id` / `content_kind` |
| `blob4` | opaque `campaign` code, or empty for a direct visit |
| `blob5` | `contact_kind` on a contact action |
| `blob6` | source: `selection_source`, `entry_source` or `evidence_source` |
| `blob7` / `blob8` | target: `target_id` / `target_kind` on Guide navigation, `evidence_id` / `evidence_kind` on an evidence open |
| `blob9` | country, ISO 3166-1 alpha-2, from the edge's `cf.country` |
| `blob10` | device class derived from the user agent: `mobile`, `tablet`, `desktop`, `unknown` |
| `blob11` | schema version, `v2` (`v1` rows stop at this column) |
| `blob12` | `session_id`: a random id held in the tab's `sessionStorage`, one per tab |
| `blob13` | region code from `cf.regionCode` (at most 16 ASCII letters, digits, hyphens) |
| `blob14` | city from `cf.city` (letters, marks, digits, space, `.`, `'`, `-`; at most 96) |
| `blob15` | metro code from `cf.metroCode` when present (at most 16 ASCII letters and digits) |
| `double1` / `double2` | `active_seconds` / `completion_percent` on `content_attention` |
| `index1` | action |

No address, user agent string, cookie, referrer, URL, latitude, longitude,
postal code, colo or other `cf` property is written. City is the most specific
geography kept, and it is only where the network reports the request came
from; a VPN, mobile gateway or corporate network can move it. Region, city and
metro have no header fallback, and a value outside its shape is stored empty.
The session id is not a cookie and ends with the tab; a malformed one drops
the event. Content IDs, codes and session ids are the opaque values the client
already restricts to `[A-Za-z0-9._:-]`. Analytics Engine keeps rows for three months and samples
at high volume, which is why the report sums `_sample_interval` instead of
counting rows.

Because the session id ends with the tab, no source here identifies a person
across visits, and the report makes no new-versus-returning claim. It labels
country, region, city, and metro as the network location reported for this
request, never as where someone is or lives.

**Reading it.** `npm run insights` queries the dataset with the Cloudflare
token it already has. The Analytics Engine SQL API is documented as needing
**Account · Account Analytics · Read** — the same row Web Analytics uses, so a
token minted by `npm run setup:insights` needs no new permission (checked
against the Cloudflare docs for the SQL API and the Analytics Engine
get-started guide on 2026-09-11). If the query fails — no permission, or a
dataset that has never been written to, which the API reports as an error
rather than an empty table — the report prints a one-line "unavailable" note,
the same way the edge section does without Zone Analytics Read. An empty
window prints a one-line "no events" note. `--no-insights` skips the query.

The Reader attention rows need one caveat. Each snapshot is a running total
for one open of one item, published on a 15-second cadence and on blur, hide
and unload, so the report shows p50 and max active seconds and completion per
item and does not sum them.

**Activation** is a separate, approved change, in this order:

1. Confirm the deployed `/privacy` notice describes the sink. `privacy.p1`
   names the Cloudflare action records, the tab session ID, city-level
   network location, three-month and 180-day retention, and assigned-link
   codes. That copy landed in BIV-421 through the copy deck, separately from
   the code. Any later change to the row needs the notice changed first.
2. Set `PORTFOLIO_INSIGHT_EVENTS_SINK` to `"analytics-engine"` in
   `wrangler.main-preview.jsonc` and deploy that candidate through the usual
   approval. The config test that pins the dormant value is updated in the
   same change so the pin moves deliberately.
3. Run `npm run insights` the next day and confirm the "Portfolio signals
   (first-party)" section reads rows.

**Rollback.** Set `PORTFOLIO_INSIGHT_EVENTS_SINK` back to `"off"`, restore the
config test's dormant pin, and deploy. The endpoint keeps answering 204 and
writes nothing. Rows already written age out of Analytics Engine after three
months. Local raw copies follow the 180-day rule below.

### Quotas, retention, and why history.jsonl exists

- Clarity allows **10 API requests per project per day** and returns at most
  the last **3 days**. Each `npm run insights` spends 4, so two full runs a day
  is the sustainable rhythm; `--no-clarity` runs the Cloudflare half free.
- Cloudflare's free plan keeps roughly **10 days** of Web Analytics.
- Both sources therefore forget faster than a job search lasts. Every run
  appends an aggregate rollup to `history.jsonl` in the insight directory.
  That file is the only durable record of the launch curve, so run it on a
  rhythm rather than only when curious.

### Where records are kept, and for how long

A run keeps the same set of records wherever it runs; only the place differs.
The scheduled Worker keeps them as objects in the private R2 bucket
`biv-portfolio-insights` under `runs/`, readable only through that Worker's
binding — the bucket has no public and no custom domain. A local
`npm run insights` keeps them in
`~/Library/Application Support/biv/portfolio-insights/` unless
`PORTFOLIO_INSIGHTS_DIR` is set, so every local run shares one history and one
prune. That directory is mode `0700`, and every file in it is mode `0600`,
written to a temporary name and renamed into place.

The two sets are separate. A local run does not append to the Worker's history
and cannot see it; the Worker's history is the durable one.

What the records are, what each one holds, and when it is deleted lives in
`scripts/portfolio-insights-records.mjs`, which both backends share, so the
180-day raw-event boundary has one owner rather than a copy per runtime.

Manual runs used to write to `<checkout>/.context/insights/`. Nothing writes
there now, and nothing prunes it. Earlier runs left only aggregate history,
`dashboard.html`, and `snapshot-*.json` there. If any `raw-events-*.json`
exist in a checkout's `.context/insights/`, delete them once:

```sh
rm -f <checkout>/.context/insights/raw-events-*.json
```

The rest of that directory can be deleted by hand once any history you want
has been copied.

| File | Holds | Kept |
| --- | --- | --- |
| `source-clarity.json`, `source-cloudflare.json`, `source-insights.json`, `source-airtable.json` | `{ capturedAt, value }`: the last response from that source that parsed. After an Airtable configuration error, `source-airtable.json` holds `{ capturedAt, value: null, configurationErrors }` instead | Until a later run parses a new one |
| `raw-events-<timestamp>.json` | One run's event-level Analytics Engine rows, the window they cover, and whether the read hit its row cap | Until the window it covers began 180 days ago (files without a recorded window: the file-name timestamp) |
| `history.jsonl` | One aggregate rollup per run, with no names or event sequences | Indefinitely |
| `dashboard.html` | The latest dashboard | Replaced by each run |

`source-airtable.json` and `dashboard.html` contain recipient names and
companies. Do not commit, copy, or upload them, and do not give the R2 bucket
a public or custom domain: the Worker's Access gate would no longer be the
only way in.

Each dashboard section shows its source's state:

- **fresh**: this run fetched and parsed it.
- **stale**: this run failed, so the section shows the last-known-good
  snapshot with its `capturedAt` time. A failed or unparsable fetch never
  touches the snapshot file.
- **unavailable**: no run has ever succeeded. The section says so and never
  shows zero.

A run is partial rather than failed when some sources answer and others do
not:

- Each source resolves on its own. Clarity's `429`, a Cloudflare error, or an
  Airtable outage shows that source's saved value as stale.
- `--no-clarity`, `--no-cloudflare`, and `--no-insights` skip the request and
  show the saved value. `--no-airtable` is different: it renders with no
  identity at all and ignores the saved Airtable copy.
- An Airtable configuration error (a duplicate or malformed code, or an Action
  linked to more than one Person, Job, or Company) replaces the saved copy
  with the errors, so neither a rebuild nor a later Airtable outage can bring
  cached names back. Every link stays unattributed until a run reads Airtable
  cleanly, and the anonymous analytics still render.
- The aggregate Analytics Engine counts and the event-level read are
  separate. If only the event read fails, the counts survive and the journeys
  come from the newest `raw-events-*.json` within 180 days, marked stale with their capture time. Stale journeys produce
  no findings; only this run's Clarity and Cloudflare findings appear. If
  the sink is unreachable or not activated, the dashboard names the missing
  capability and still shows Clarity and Cloudflare.
- The history row records only what this run measured. A stale or missing
  source is `null`, and journeys are recorded as `unavailable`, never as zero
  sessions.
- The run exits non-zero only when no source, current or saved, can fill a
  dashboard.

`npm run insights:dashboard` (`--dashboard --no-cloudflare --no-clarity`)
calls no source. It rebuilds the page from the saved snapshots and the newest
raw events, and records no history row. Runs from before the
source-wise files wrote `snapshot-*.json` beside the history. Nothing reads
those files now, and they can be deleted by hand.

Pruning runs last, after the history row and the dashboard are both written,
so an aborted run never loses raw events it has not yet summarised. It deletes
only `raw-events-*.json` files whose window began more than 180 days ago, and
the stale fallback never reads such a file or any event older than 180 days.
Source snapshots and aggregate history are never pruned.

The scheduled run holds nothing beyond the three read-only tokens above and
write access to its own R2 prefix. It makes no request that mutates anything
remote. A local run holds the same three, from the login Keychain, and writes
only inside its own directory.

### Assigned-link attribution

The report matches each event's campaign code to the Action whose
`Portfolio Campaign Code` equals it. A matched row reads
"Activity from <name>'s assigned link" and never "<name> visited" or
"<name> read". A link can be forwarded, opened by a mail scanner, or used on
a shared device, so a code identifies the assignment, not the person holding
the browser.

- A code no Action carries stays anonymous and is not an error. Analytics
  Engine keeps events for three months, so a deleted test Action or an old
  link leaves its code behind that long. What changed says so in one line, for
  example "3 tab sessions came from a link that is not in Airtable, kept
  anonymous: smoke-7de62efc", and the terminal lead says the same sentence.
  Nothing needs fixing; delete nothing to make it go away.
- An Action with a code but no Person shows as unassigned outreach.
- Duplicate or malformed codes in Airtable turn the whole Airtable source into
  a configuration error. The report never guesses which Action a shared code
  belongs to, and no activity is attributed until the codes are fixed.

To recover from a configuration error (a duplicate or malformed code, or an
Action linked to more than one Person, Job, or Company — an unmapped code is
not one and needs no recovery):

1. Fix the duplicate or malformed `Portfolio Campaign Code` values in
   Airtable. A malformed code does not match `[a-z0-9][a-z0-9_-]{5,63}`.
2. In the job-search repository, run
   `python3 scripts/migrate_v2.py --portfolio-fields-only --verify`.
3. Run `npm run insights` again and confirm the Airtable source reads fresh.

### Observe in Clarity

Clarity documents no URL that carries filters. Share links exist only on the
Recordings and Heatmaps pages, are created by hand, and have no documented
format ([Share Clarity](https://learn.microsoft.com/en-us/clarity/setup-and-installation/share-clarity)).
Segments have no documented URL either
([Segments](https://learn.microsoft.com/en-us/clarity/filters/clarity-segments)).
The dashboard's Clarity controls therefore open the project at
`https://clarity.microsoft.com/projects/view/yatoiqtrjm/` and print the
values to enter. The report builds no Clarity query parameters.

In the project
([Filters](https://learn.microsoft.com/en-us/clarity/filters/clarity-filters),
[Custom tags](https://learn.microsoft.com/en-us/clarity/filters/custom-tags)):

1. For a link or a story, open Filters → Custom tags, choose
   `portfolio_campaign` or `portfolio_content_id`, pick the value the
   dashboard printed, and Apply.
2. For a city, open Filters → User info → Location, choose Country/Region,
   then State, then City, and Apply.
3. For a heatmap, set the device first. Then open Heatmaps, choose the page
   URL, select View Heatmap, and pick Click, Scroll, or Attention under
   Heatmaps types.
4. For recordings, open Recordings with the same filters applied.

For a campaign worth watching over weeks, save the step 1 filter as a
Segment so it is one click next time.

## Being found by search

`/sitemap.xml` is generated from the same page inventory as the share
metadata, so a new record or theme is listed the moment it is authored, and
`/robots.txt` points at it while disallowing the supporting surfaces the
worker already marks `noindex`. Cloudflare prepends its content-signal
comments to `robots.txt` at the edge; that block carries no directives and
does not change what crawlers may do.

Registering the site in Google Search Console and submitting the sitemap is a
dashboard step for Bradley. Until then Googlebot's crawl requests in the edge
report are the only evidence of search interest, and search referrals in the
Cloudflare and Clarity source tables are the only evidence of search traffic.

## Verify Clarity's own consent settings

The code controls two of the three settings that decide what Clarity stores.
The third lives in the Clarity dashboard and has to be read there before
launch, then recorded against the reviewed `/privacy` notice.

| Setting | Where it lives | Value |
| --- | --- | --- |
| `ad_Storage` | `setPrivacySafeReplayConsent` | Always `denied`. Never used for advertising. |
| `analytics_Storage` | The stored browser preference | `granted` or `denied` when one is saved; not sent when none is. |
| Clarity's own cookies | Clarity project `yatoiqtrjm`, Settings → Setup → Advanced settings | **Off** since 2026-09-08, so Consent Mode is on. |

The third row decides what a first visit does before any preference exists.
The toggle reads the other way round from the behaviour: **Cookies off** is
what turns Consent Mode on, so Clarity waits for a `granted` before setting
`_clck` or `_clsk`. That is the state this project is in, which is why the
reviewed `/privacy` notice — which describes the preference this site stores,
not identifiers Clarity sets for itself — is accurate as written. The cost is
that recordings are not linked into multi-page sessions until a visitor opts
in. If anyone turns that toggle back on, the notice needs a sentence about
Clarity's cookies, and that copy change goes to Bradley through the copy deck.

Leave Clarity's Google Analytics, Google Ads and Microsoft Ads integrations
unconnected. Each adds a processor and cookies the reviewed notice does not
describe, and none of them answers a question Cloudflare's edge analytics and
Clarity do not already answer.

## Activation boundary

Analytics fails closed. Clarity starts only when an eligible public document
has `data-portfolio-analytics-context="external"` on its root element. A
missing marker keeps it dormant.

`worker/public-portfolio.ts` writes the `external` marker, and only when the
request host is `bradleyberkman.com` or `www.bradleyberkman.com`. Local
development, `workers.dev` previews, and supporting routes are all excluded by
that rule, so no build carries the marker by itself. (Before PER-16 this was
also conditioned on `PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED`; that gate no
longer exists.)
