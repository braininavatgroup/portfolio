# Password-protected main preview activation packet

Status: dormant. This packet defines the separate approval, deployment, smoke,
and rollback procedure for the permanent preview of the latest successfully
tested `main`. Adding this packet and its workflow does not authorize activation.

## Bound release

- Target Worker: `bradley-portfolio-main-preview`.
- Access boundary: the generated
  `bradley-portfolio-main-preview.<account-subdomain>.workers.dev` hostname plus
  the shared portfolio-preview password.
- Routes: Workers.dev only. Do not add a custom domain, zone route, or public
  portfolio hostname.
- Artifact: the exact `dist/` uploaded by the successful `ci` job for a push to
  `main`. The deployment job downloads that artifact and does not rebuild it.
- Automation gate: the repository variable
  `PORTFOLIO_MAIN_PREVIEW_DEPLOY_ENABLED` must equal `true`. Missing or any other
  value leaves deployment dormant.
- GitHub environment: `portfolio-main-preview` with independent approval before
  deployment.

Record the reviewed merge commit, CI run URL, sorted `dist/` SHA-256 digest,
Cloudflare Worker version, Workers.dev hostname, activation approver, activation
time, and known-good prior version before changing the gate.

## Runtime secrets and configuration

Provision these only as encrypted secrets on the dedicated Worker:

- `OPENAI_API_KEY`
- `PORTFOLIO_MAIN_PREVIEW_PASSWORD`
- `PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET`

Use a strong shared passphrase for the password and an independently generated
high-entropy signing secret. Never place either value in GitHub source,
repository variables, workflow files, command arguments, chat, or logs. The
GitHub environment separately holds the least-privilege
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` used by Wrangler.

`wrangler.main-preview.jsonc` requires the password gate, sends every static
asset through the Worker, and retains the 200-request UTC-day chat budget. A
missing or undersized password/signing secret fails closed with a redacted 503.
Successful login creates a seven-day `HttpOnly`, `Secure`, `SameSite=Lax`
cookie. There is intentionally no logout route or failed-login throttle in this
version.

Changing the shared password controls new logins but does not invalidate an
already signed browser session. Rotate the session secret whenever all existing
sessions must end; this invalidates every current cookie. Rotate both secrets
when replacing access completely.

## Activation approval

Activation requires Bradley's explicit approval of one immutable operation:

- reviewed merge commit and CI run;
- `dist/` digest;
- target Worker and generated hostname;
- exact secret names and scoped Cloudflare account;
- deployment operation and GitHub environment;
- expected chat/data/spend scope;
- rollback version or deletion containment;
- approval expiry.

After that approval, a separately identified operator may provision only the
listed Worker secrets and GitHub environment credentials, set the repository
variable to `true`, and dispatch or observe the exact merged `main` workflow.
The operator must not add routes, broaden token permissions, substitute an
artifact, or retain secret values.

## Live smoke matrix

Run and record these checks on the deployed hostname, including one iPhone test
over cellular rather than home Wi-Fi:

| Check | Expected result |
| --- | --- |
| Signed-out root | Redirects to `/_portfolio-preview/login` and is marked `noindex, nofollow` |
| Wrong password | Generic 401, no session cookie, and no configuration detail |
| Correct password | Redirects to the requested same-origin path and sets the seven-day secure cookie |
| Protected asset | Loads only after authentication and retains the `noindex, nofollow` response header |
| iPhone over cellular | Password form, graph, HTML index, and a case study load outside the home network |
| Chat | One grounded question reaches `/api/portfolio-chat` after login and remains within the 200/day budget |
| Session | Reload works; a different unsigned browser remains locked out |
| Secret isolation | No password, signing secret, provider key, question, answer, or IP address appears in client assets or telemetry |

Use deterministic local proof for forced budget exhaustion and provider errors;
do not consume live requests solely to manufacture failure evidence.

## Rollback and containment

Before deployment, record the currently healthy Worker version as
`STABLE_VERSION_ID`. If the new version is unhealthy, roll back the dedicated
Worker and verify both the password boundary and a known-good page:

```sh
npx wrangler rollback "$STABLE_VERSION_ID" \
  --config wrangler.main-preview.jsonc \
  --message "main preview rollback" \
  --yes
```

Set `PORTFOLIO_MAIN_PREVIEW_DEPLOY_ENABLED` back to `false` before the next push
if automatic deployment must stop. If there is no healthy prior version and the
hostname must be contained, delete only this dedicated Worker:

```sh
npx wrangler delete bradley-portfolio-main-preview \
  --config wrangler.main-preview.jsonc
```

Do not use `--force`. Record the rollback or deletion, post-containment smoke,
and final variable state in the activation record.
