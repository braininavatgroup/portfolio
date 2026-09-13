# Public launch checklist

Status: pending. Owner: the agent assigned the public-launch change.

Read this when preparing to publish the portfolio, remove the preview login,
or enable public analytics. Finish the copy pass first. This checklist records
the launch work; it does not authorize deployment or changes to live controls.

## Finish the current copy pass

- [x] Integrate Reporting commit `e0808f7` with the reviewed copy, preserving
  the four-week reporting comparison. Reporting’s hover uses its dashboard capture.
  Reconcile any later Reporting changes before the final combined review.
- [x] Replace the six Touring screenshots with the approved interactive demo
  from `f535106`; use its capture for the hover preview. Include the demo and
  capture in the artifact review below.
- [ ] Bradley reviews every artifact that will be publicly accessible,
  including screenshots, videos, PDFs, downloads, and interactive demos.
  Redact sensitive information from the underlying files and demo data,
  including client details, contact information, financial information, and
  credentials. Check thumbnails, captions, metadata, and linked files too.
  Bradley signs off on the final redacted versions before launch.
- [ ] Run the required GitHub checks against the combined PR head and complete
  Bradley's final visual walk.

## Prepare the public-launch change

- [x] Repair Clarity's saved opt-in handling. When an eligible page starts
  Clarity, forward an explicitly saved `granted` preference to the consent API.
  Preserve preview exclusion and the behavior for absent or denied consent.
  GitHub must prove: opt out, enable on an excluded page, reload, and forward
  the saved consent. Sources: `components/PortfolioAnalytics.tsx` and
  `lib/portfolio-analytics.ts`.
  Done: `PortfolioAnalytics` forwards a stored `granted` to
  `setPrivacySafeReplayConsent` immediately after a successful start, before
  the entry event. Covered by `components/PortfolioAnalytics.test.tsx` —
  "forwards a saved opt-in to Clarity on the next eligible load" walks opt out
  → enable on the excluded page → reload → `consentv2 granted`, and "keeps a
  saved opt-in dormant on a preview document" holds the preview exclusion. The
  existing absent-preference and stored-opt-out tests still pass unchanged, so
  no consent signal is fabricated where none was saved.
- [x] Prepare public access. The current domain uses
  `PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED=true` in
  `wrangler.main-preview.jsonc`. The public candidate must serve the portfolio
  and `/privacy` without a preview cookie or login redirect. Remove the
  preview-only search exclusion from public portfolio pages; retain deliberate
  exclusions for private/supporting routes. Verify public chat protections
  still work after removing the preview password boundary.
  Done: the candidate sets `PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED=false`,
  which drops the login redirect and the blanket `noindex` in one move.
  `worker/public-portfolio.ts` now owns what replaced it — public portfolio
  pages carry no crawler exclusion, and the supporting routes keep
  `noindex, nofollow, noarchive`.
  Superseded by PER-16: the gate is gone entirely, so "both modes" no longer
  describes anything. `/copy-deck` and `/copy-deck.zip` were deleted as stale,
  and `/design` is dev-only — the deployed Worker 404s it
  (`worker/design-gallery.ts`). `/_portfolio-feedback/*` still carries the
  exclusion. Tests:
  `worker/public-portfolio.test.ts` and the updated
  `tests/main-preview-worker-config.test.mjs`.
  Chat protections are independent of the password gate and unchanged: the
  per-IP throttle and the derived actor identity run whether or not the
  session flag is set (`lib/server/portfolio-chat-launch.ts`, proved by
  "throttles per actor even when the session is not required"), the daily
  provider budget still caps spend at 1,000, and the guard fails closed on a
  missing limiter or connecting IP. See the two boundaries below for what this
  does *not* cover.
- [x] A session token, not a bot check, guards the public candidate.
  Cloudflare Turnstile was removed on 2026-09-09: it demanded a fresh
  single-use token per message, so Cloudflare escalated repeat askers to a
  visible checkbox between every question. The endpoint now requires a signed,
  IP-bound, HttpOnly session cookie issued by `/api/portfolio-chat/session`
  and renewed on every accepted request
  (`lib/server/portfolio-chat-session.ts`, `PORTFOLIO_CHAT_SESSION_REQUIRED`).
  It needs only `PORTFOLIO_CHAT_IDENTIFIER_SECRET` and the bound rate limiter
  — both already provisioned — and nothing is compiled into the client bundle,
  so any CI artifact carries it.
  Scope, stated plainly: this stops scripts that never load the site. It does
  not stop anyone willing to fetch a session first. That is the accepted
  trade — the per-IP throttle and the 1,000/day allowance bound the damage, and
  the failure mode is a day of "come back tomorrow", not an unbounded bill.
- [x] Prepare public analytics. Eligible public HTML must carry
  `data-portfolio-analytics-context="external"`. Keep local development and
  private previews excluded, and preserve personal browser opt-outs.
  Done: `worker/public-portfolio.ts` writes the `external` marker only when
  the password gate is off *and* the request host is `bradleyberkman.com` or
  `www.bradleyberkman.com`. Local development, `workers.dev`, non-HTML
  responses and supporting routes stay unmarked, and the password-gated
  preview keeps writing `preview`. No build carries the marker by itself, so
  the marker is emitted by a deployment, not by this change. `?analytics=off`
  and the `/privacy` control are untouched.
- [x] Clarity's cookie setting checked and aligned with the Privacy notice.
  `ad_Storage` is always `denied` and `analytics_Storage` follows the saved
  preference, both verifiable in code. The third setting, Clarity's own
  cookies, was read in the dashboard on 2026-09-08 and turned **off** —
  Consent Mode on, so Clarity sets no `_clck`/`_clsk` until it receives an
  explicit `granted`, which this site sends only for a saved opt-in. The
  reviewed `/privacy` notice is therefore accurate as written and needs no
  copy change. Cost accepted: recordings are not linked into multi-page
  sessions for visitors who have not opted in. Clarity's Google Analytics,
  Google Ads and Microsoft Ads integrations were deliberately left
  unconnected. See [insights operations](../portfolio-insights-operations.md).

## Activate and verify

- [ ] Obtain Bradley's explicit approval for the tested launch artifact,
  target, control changes, and rollback under the workspace's production
  authority rules. Merge approval alone does not activate public access or
  tracking.
- [ ] After the approved deployment, inspect the actual domain while signed
  out: no portfolio login redirect, no preview-only search exclusion, and the
  reviewed Privacy page is accessible.
- [ ] Verify Clarity on that deployed artifact: eligible public visits behave
  according to consent, opted-out browsers do not load the tag after reload,
  re-enabling survives reload, and chat text remains masked in replay.

Mark each item complete with its PR/check or observation. Do not mark the
launch complete while any item is unchecked. Record the deployed commit and
verification evidence in the launch PR.
