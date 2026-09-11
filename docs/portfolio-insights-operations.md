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

## Use opaque job-search links

Generate a random code that carries no human meaning, for example:

```sh
openssl rand -hex 8
```

Add it to a portfolio URL as `campaign=<code>`. The browser removes the
parameter from the visible URL, keeps it only for the current tab session, and
adds it to later portfolio insight signals. Never use a company name, person's
name, email address, job title, or recognizable abbreviation as the code.

Keep the mapping in the private opportunity tracker, outside this repository
and Clarity. A practical row contains:

- opaque campaign code;
- opportunity and recipient class;
- date and channel sent;
- eventual response, interview, offer, or closed outcome.

Clarity answers what an eligible visitor did. The private tracker answers
which outreach and job outcome that anonymous code represents. Do not add the
mapping or outcome to portfolio telemetry.

## Read the signals

Use Clarity for eligible human behavior: entries, content opens and their
selection source, active Reader time, maximum Reader completion, evidence
opens, Guide evidence navigation, and contact-action kinds. Treat Draw, Hold,
and Advance as working analysis lenses, not permanent product categories.

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
npm run setup:insights      # once, per machine: mint and store the two tokens
npm run insights            # last 7 days of Cloudflare, last 3 of Clarity
npm run insights -- --history   # one row per past run, oldest first
npm run schedule:insights   # once, per machine: run it daily at 07:10
npm run insights:dashboard  # open the dashboard rebuilt from what is on disk
```

### The dashboard

Every run that records a snapshot also rewrites `dashboard.html` beside the
history: one self-contained page, no scripts or network, that shows the
believable-humans tiles, the curve across runs, day-by-day columns, where
sessions come from, what gets read, who is crawling, web vitals by device,
and the frustration signals. Each chart has a table view and works in light
and dark. `npm run insights -- --dashboard` opens it after a live run;
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
dimension. Read those in the Clarity dashboard.

`campaign=<code>` is stored as the custom tag `portfolio_campaign`, not as
`utm_campaign`, so it does not reach the export API's Campaign dimension
either. It is dashboard-only for the same reason.

### The scheduled run

`npm run schedule:insights` installs a launchd user agent,
`com.biv.portfolio-insights`, that runs the report daily at 07:10 local time
from the checkout it was installed for and appends to
`~/Library/Application Support/biv/portfolio-insights/history.jsonl`, a
location that outlives any single worktree (`PORTFOLIO_INSIGHTS_DIR` is what
moves the history there; a manual run without it still writes to
`.context/insights/`). It logs to `~/Library/Logs/biv/portfolio-insights.log`.
`--now` also kicks off a run immediately; `--remove` unloads and deletes the
job and keeps the history. The installer refuses an ephemeral Conductor
worktree; set `PORTFOLIO_INSIGHTS_REPO` to the canonical clone when installing
from one. The job runs whatever that clone has checked out, so keep it on
`main`.

The first-party sink below exists to close exactly this gap. Until it is
activated, those signals stay dashboard-only, and the report says so in one
line rather than printing zeros.

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

1. A `/privacy` copy review through the copy deck. The notice describes
   Clarity only; a first-party sink is a second processor (Cloudflare, already
   the host) and a second place the same events land, and the notice has to
   say so before any row is written. Do not edit the page copy in the same
   change as the code.
2. Set `PORTFOLIO_INSIGHT_EVENTS_SINK` to `"analytics-engine"` in
   `wrangler.main-preview.jsonc` and deploy that candidate through the usual
   approval. The config test that pins the dormant value is updated in the
   same change so the pin moves deliberately.
3. Run `npm run insights` the next day and confirm the "Portfolio signals
   (first-party)" section reads rows. Rolling back is the reverse flip; rows
   already written age out after three months.

### Quotas, retention, and why history.jsonl exists

- Clarity allows **10 API requests per project per day** and returns at most
  the last **3 days**. Each `npm run insights` spends 4, so two full runs a day
  is the sustainable rhythm; `--no-clarity` runs the Cloudflare half free.
- Cloudflare's free plan keeps roughly **10 days** of Web Analytics.
- Both sources therefore forget faster than a job search lasts. Every run
  appends a rollup to `.context/insights/history.jsonl` and writes a full
  snapshot beside it. That gitignored file is the only durable record of the
  launch curve, so run it on a rhythm rather than only when curious.

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
missing marker and the main preview's `preview` marker keep it dormant.

`worker/public-portfolio.ts` writes the `external` marker, and only when
`PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED` is not `true` and the request host
is `bradleyberkman.com` or `www.bradleyberkman.com`. Local development,
`workers.dev` previews, supporting routes, and the password-gated preview are
all excluded by that rule, so no build carries the marker by itself. Emitting
it in production still requires an approved deployment of a candidate with the
gate off; the code alone activates nothing.
