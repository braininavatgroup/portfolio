# Password-protected main preview design

## Status

Approved for dormant implementation by Bradley on 2026-08-27. Secret creation, GitHub environment configuration, first deployment, and activation remain separate protected actions.

## Goal

Provide one stable Cloudflare Workers preview of the latest successfully tested `main` commit. Bradley can open it while his Mac is offline and can share one password with a small group of draft reviewers.

## Deployment boundary

Create a new Worker named `bradley-portfolio-main-preview`. Do not repurpose the bounded `bradley-portfolio-preview` Worker or change its BIV-317 activation and rollback record. The new Worker uses only its generated Workers.dev hostname, with no custom domain or zone route.

GitHub Actions builds and tests the exact `main` commit. A deploy job consumes that same build output only after CI succeeds. The deploy job stays dormant unless the repository variable `PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED` equals `true`. Enabling that variable, creating the GitHub environment and Cloudflare secrets, and running the first deployment are activation actions outside this implementation.

## Password gate

`PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED=true` enables a deployment-boundary gate before the Vinext application, static assets, image optimizer, and API routes. Local development and the existing bounded preview omit this value and preserve their current behavior.

Unauthenticated `GET` and `HEAD` requests redirect to `/_portfolio-preview/login` with a same-origin return path. The login page is an inline, dependency-free HTML response. `POST /_portfolio-preview/login` accepts one bounded URL-encoded `password` field. A correct password sets a seven-day `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` cookie and redirects to the validated return path. A wrong password returns the same generic page with HTTP 401.

The first version has no logout route and no failed-login throttling. Sessions end through expiry or credential rotation. Use a strong shared passphrase. Rotate both the password and session-signing secret to invalidate existing sessions. Retain the independent 200-request UTC-day chat budget.

All protected responses receive `X-Robots-Tag: noindex, nofollow, noarchive`. Non-navigation methods without a valid session return a redacted JSON 401. Missing or malformed gate configuration fails closed with a redacted 503.

## Secret and session handling

Declare `OPENAI_API_KEY`, `PORTFOLIO_MAIN_PREVIEW_PASSWORD`, and `PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET` as required Worker secrets. Values never appear in source, Wrangler variables, GitHub workflow arguments, client assets, structured logs, or error responses.

Compare password digests with a timing-safe operation. Sign session payloads with HMAC SHA-256 through Web Crypto. A session contains only its expiry. Reject malformed, expired, or incorrectly signed cookies. Do not record reviewer identity, the password, cookies, raw IP addresses, questions, or answers.

## Static assets

The new Wrangler config sets `assets.binding=ASSETS` and `assets.run_worker_first=true`. Every request therefore reaches the password gate before Cloudflare can serve a matching asset. After authentication, the Worker serves matching assets through `env.ASSETS.fetch(request)` and falls back to the Vinext handler for application routes.

## Automation and rollback

The existing CI job remains authoritative for tests, lint, dev-start proof, worktree bootstrap proof, and rendered build proof. It uploads the built `dist/` directory only for a push to `main`. The gated deploy job downloads that artifact, installs the pinned repository dependencies, deploys `wrangler.main-preview.jsonc`, and records the commit SHA and Wrangler deployment output.

The activation packet must bind the deployed artifact digest, commit, Worker version, hostname, smoke evidence, password/session secret rotation procedure, and prior stable version. Rollback uses the recorded Worker version. No workflow or implementation step may create secrets, enable the repository variable, or deploy automatically before Bradley authorizes that exact activation.

## Verification

Durable tests cover disabled pass-through, fail-closed configuration, login rendering, bounded bodies, wrong passwords, secure cookies, accepted sessions, tampered sessions, expired sessions, safe redirects, JSON rejection for unauthenticated API calls, static-asset gating, and noindex headers. Config tests validate the Workers.dev-only boundary, required secrets, `run_worker_first`, Durable Object budget, and Wrangler dry run. CI syntax and the false activation gate receive deterministic tests.

## Exclusions

- No Cloudflare Access policy.
- No custom domain.
- No per-reviewer accounts, invitations, or audit trail.
- No logout route.
- No failed-login throttling until observed guessing traffic justifies it.
- No production/customer data access, live credential use, secret creation, deployment, or activation in this change.
