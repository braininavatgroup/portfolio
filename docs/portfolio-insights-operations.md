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
