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
npm run setup:insights   # once, per machine: mint and store the two tokens
npm run insights         # last 7 days of Cloudflare, last 3 of Clarity
```

`npm run setup:insights` walks through minting a Cloudflare API token and a
Clarity Data Export token and stores each in the macOS login Keychain under
`biv-portfolio-insights`. Neither token can be minted by a script — Cloudflare
refuses to let an API token create another API token, and Clarity has no token
API — so both come from a dashboard. `CLOUDFLARE_API_TOKEN` and
`CLARITY_API_TOKEN` in the environment override the stored ones.

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

Cloudflare samples adaptively, and it samples harder over a wider window: at
`--days 10` the counts round to the nearest ten and a referrer worth nine
pageloads disappears entirely, while the same query at `--days 7` shows it. When
the question is *did anyone arrive from outside*, ask a narrow window.

### What the export API cannot answer

The Clarity Data Export API breaks down by Browser, Device, Country/Region, OS,
Source, Medium, Campaign, Channel and URL only. The portfolio's own signals —
Reader active time, Reader completion, evidence opens, Guide navigation,
contact-action kinds — are custom Clarity events (`portfolio_*`) with no export
dimension. Read those in the Clarity dashboard.

`campaign=<code>` is stored as the custom tag `portfolio_campaign`, not as
`utm_campaign`, so it does not reach the export API's Campaign dimension
either. It is dashboard-only for the same reason.

### Quotas, retention, and why history.jsonl exists

- Clarity allows **10 API requests per project per day** and returns at most
  the last **3 days**. Each `npm run insights` spends 4, so two full runs a day
  is the sustainable rhythm; `--no-clarity` runs the Cloudflare half free.
- Cloudflare's free plan keeps roughly **10 days** of Web Analytics.
- Both sources therefore forget faster than a job search lasts. Every run
  appends a rollup to `.context/insights/history.jsonl` and writes a full
  snapshot beside it. That gitignored file is the only durable record of the
  launch curve, so run it on a rhythm rather than only when curious.

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
