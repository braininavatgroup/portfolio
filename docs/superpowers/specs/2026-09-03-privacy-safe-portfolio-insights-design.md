# Privacy-safe portfolio insights design

## Status

Approved by Bradley on 2026-09-03. Bradley also required his personal devices
and use to stay outside the trusted visitor dataset. Deployment, public
activation, new storage, and citation monitoring remain separate protected
effects.

## Goal

Measure how external visitors move through arbitrary portfolio records and
threads without collecting authored content, personal identifiers, or a fixed
theory of which work matters. The measurements support record, feature, and
job-search decisions while the portfolio's positioning remains editable.

## Decision metrics

The implementation records mechanics. Analysis composes those mechanics into
three provisional measures:

- **Draw:** an eligible external session opens a record or thread. Compare
  opens with eligible entries rather than raw page traffic.
- **Hold:** active Reader seconds and maximum normalized completion for the
  opened item. Review the two together because long records need more time and
  short records can complete quickly.
- **Advance:** the session later opens another item, evidence, Guide evidence,
  the CV, a contact route, a professional profile, or the practice site.

These measures have no target values in source. Baselines must come from clean
external traffic first. Record IDs, thread IDs, role groupings, proof
membership, and featured rankings are dimensions supplied by current content,
not analytics configuration.

## Trust boundary

Analytics eligibility is decided before the Clarity bootstrap exists. The
client checks these conditions in order:

1. A one-time `analytics=off` query parameter writes the existing denied
   preference, removes itself with `history.replaceState`, and suppresses the
   current visit. Bradley uses this clean enrollment link once in each browser
   profile he controls.
2. A stored denied preference suppresses Clarity and all custom events. The
   privacy page remains the place to re-enable analytics deliberately.
3. The root element must carry
   `data-portfolio-analytics-context="external"`. A missing value and every
   other value suppress Clarity. Public activation must add this explicit
   marker in a separate protected change.
4. An authenticated main-preview HTML response instead carries
   `data-portfolio-analytics-context="preview"`. That value suppresses Clarity
   even if storage is empty or says granted.
5. Hosts outside the public apex and `www` names remain ineligible.

Any failed eligibility check leaves `window.clarity` undefined and inserts no
Clarity script. The preview marker is response context, not identity. The
Worker keeps the signed authentication cookie `HttpOnly` and does not expose
its value or derive a visitor identifier from it.

The main-preview password wrapper adds the marker only to authenticated HTML.
It leaves assets, API responses, login pages, and deployments with the gate
disabled unchanged. The transformation also preserves the existing no-index
headers. A transformation failure leaves the required `external` value absent,
so client analytics stays dormant.

## Analytics adapter

`lib/portfolio-analytics.ts` remains the single browser adapter. It owns:

- the eligibility decision and replay bootstrap;
- consent changes;
- validated opaque campaign capture;
- safe Clarity tags and custom event calls;
- the pure active-attention accumulator.

The event function accepts an action name plus string dimensions rather than a
closed event union or record registry. It validates names and values, bounds
their length, and ignores invalid values. Callers send only IDs, content kind,
selection source, visual format, contact kind, elapsed seconds, and completion
percentage. They never send prose, Guide questions or answers, email
addresses, URLs containing private data, feedback, or DOM text.

Clarity custom tags carry the dimensions that operators need for filters. A
custom event marks the action after its tags have been queued. Tests protect
the adapter mechanics with invented IDs; they do not enumerate a permanent
event catalog.

## Attribution

Job-search links use `campaign=<opaque-code>`. Codes contain only lowercase
ASCII letters, digits, `_`, and `-`, with bounded length. The bootstrap removes
the parameter before it inserts Clarity, stores the code in session storage,
and attaches it to later measurements in that tab.

The code has no meaning outside Bradley's private opportunity tracker. The
tracker maps it to an opportunity, recipient class, send date, and eventual
outcome. No company, person, job title, email address, or outcome is sent to
Clarity. Direct visits use a generic entry source and carry no fabricated
campaign code.

## Attention accounting

`PortfolioReader` supplies its persistent `.reader-scroll` element and the
current arbitrary item identity to a small hook backed by the pure accumulator.
The accumulator receives time, visibility, focus, activity, and scroll
observations. This makes its timing deterministic in tests.

Time accrues only while all three conditions hold:

- `document.visibilityState` is `visible`;
- `document.hasFocus()` is true;
- the last pointer, keyboard, touch, or Reader scroll activity falls inside a
  30-second idle window.

The accumulator closes an interval at the exact hide, blur, or idle boundary,
so a delayed timer cannot credit abandoned time. Activity resumes a new
interval only when visibility and focus also permit it.

Completion is the maximum clamped percentage derived from the nested Reader
scroll position and its scrollable extent. A non-scrollable item is complete
when rendered. The hook publishes bounded snapshots during active reading and
flushes the last changed snapshot on item change or page hide. Each snapshot
contains content kind, content ID, active seconds, and maximum completion. It
contains no content length or text.

## Interaction ownership

`PortfolioExperience` keeps navigation ownership and records the source at the
same callbacks that change selection. Sources are generic UI locations such as
URL entry, Contents, Map, Reader, and Guide. Opening the same content from a
different location therefore remains distinguishable without changing the
content model.

`PortfolioReader` records evidence or visual opens and contact action kinds at
the existing controls. Guide evidence navigation records the cited target ID
when `PortfolioExperience` accepts the target. Invalid or missing content IDs
remain no-ops, matching current navigation behavior.

Chat masking remains unchanged. The adapter does not observe the chat DOM,
questions, answers, feedback notes, or editor state.

## Failure behavior

- Unavailable local or session storage does not enable an excluded session.
  The one-time opt-out still applies in memory for the current page.
- A blocked Clarity script leaves event calls as harmless no-ops.
- Invalid campaign codes are removed and discarded.
- Attention snapshots with no accrued time or completion change are omitted.
- Preview marking applies only to HTML and never rewrites API or asset bodies.

## Verification

Test-first implementation covers:

- an authenticated preview document receives the marker and a disabled gate
  does not alter downstream HTML;
- local hosts, preview documents, a stored opt-out, and the one-time personal
  device enrollment path insert no script and queue no events;
- an explicit external context starts Clarity once without fabricating a
  consent choice, explicit preferences deny advertising storage, and a
  missing or unknown context stays dormant;
- arbitrary content IDs and campaign codes propagate through the generic
  adapter without a record registry;
- hidden, unfocused, and idle intervals add no active time;
- delayed samples stop at the idle boundary;
- Reader completion uses its own scroll extent and never decreases;
- record or thread opens, evidence, Guide navigation, and contact actions emit
  only safe dimensions.

Focused tests run first for each red-green cycle. Final proof runs typecheck,
lint, dead-code analysis, the full unit suite, the rendered build suite, and a
headless check against the existing Conductor workspace server when it is
available. Worker configuration uses Wrangler dry-run only. No command deploys
or activates the site.

## Operator runbook

A short repository runbook will explain:

- enrolling and verifying every Bradley-controlled browser profile before
  ordinary use;
- minting opaque campaign links and keeping their meanings private;
- joining campaign behavior to the private outcome tracker;
- using Clarity for human behavior and Cloudflare for aggregate edge and
  crawler traffic;
- treating crawler access as separate from evidence that an AI answer cited
  the portfolio.

The runbook will say how to verify exclusion by checking that no Clarity script
or collection request appears. It will not require a new service, credential,
or production data read.

## Exclusions

- No analytics database, Durable Object, KV namespace, MCP integration, or
  citation monitor.
- No identity inference, IP allowlist, fingerprint, or special Bradley user
  record.
- No record ranking, role taxonomy, proof set, featured list, or target baked
  into source or tests.
- No deployment, gate change, secret use, Clarity project mutation, or public
  activation.
