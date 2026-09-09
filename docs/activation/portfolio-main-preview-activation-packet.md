# Password-protected main preview activation packet

Status: active. This packet defines the approval, deployment, smoke, and
rollback procedure for the permanent preview of the latest successfully tested
`main`.

## Bound release

- Target Worker: `bradley-portfolio-main-preview`.
- Access boundary: `bradleyberkman.com`, `www.bradleyberkman.com`, and the
  generated `bradley-portfolio-main-preview.<account-subdomain>.workers.dev`
  hostname, all behind the same shared portfolio-preview password.
- Routes: Cloudflare Worker Routes for the apex and `www`, plus Workers.dev.
  No other hostname or zone route is authorized.
- Artifact: the exact `dist/` uploaded by the successful `ci` job for a push to
  `main`. Neither deployment workflow rebuilds or overwrites that artifact.
- First deployment: the manual `deploy-main-preview.yml` workflow downloads the
  SHA-named artifact from the approved successful source run ID, recomputes its
  sorted `dist/` SHA-256 digest, and deploys only when that digest exactly
  matches the approved workflow input.
- Later deployment: while the gate remains armed, each ordinary successful
  `main` push deploys its own newly tested, immutable artifact through `ci.yml`.
- Automation gate: the repository variable
  `PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED` must equal `true`. Missing or any other
  value leaves deployment dormant.
- GitHub environment: `portfolio-main-preview` with independent approval before
  deployment.

Before changing the gate, confirm the `bradleyberkman.com` zone is active on
Cloudflare, GoDaddy delegates to Cloudflare’s assigned nameservers, and the
apex and `www` each have an existing proxied DNS record for the Worker Route to
intercept. Record the reviewed merge commit, CI run URL, sorted `dist/` SHA-256
digest, Cloudflare Worker version, all three hostnames, certificate status,
activation approver, activation time, and the known-good prior version.

## Runtime secrets and configuration

Run `npm run setup:main-preview` from the prepared feature branch for initial
human-driven setup. After the setup change has merged, run it from a clean
`main` checkout only when local `HEAD` equals freshly fetched `origin/main`.
That post-merge path skips feature-branch publication and pull-request creation,
finds the successful `ci.yml` push run for the exact merged SHA, downloads its
existing SHA-named artifact, computes and displays the sorted `dist/` SHA-256
digest, and waits for the operator to record and approve that binding. Only
after the operator types exact `ACTIVATE` does the wizard set and read back the
deployment gate as `true`, then dispatch `deploy-main-preview.yml` with the
source run ID, source SHA, and digest. The manual workflow checks out that exact
SHA, downloads the artifact from the source run, verifies the digest, and
deploys without rebuilding. The wizard otherwise keeps deployment false-gated.

Provision these only as encrypted secrets on the dedicated Worker:

- `OPENAI_API_KEY`
- `PORTFOLIO_MAIN_PREVIEW_PASSWORD`
- `PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET`
- `PORTFOLIO_FEEDBACK_ADMIN_TOKEN` — the bearer token for the reviewer
  feedback digest (`npm run feedback`); at least 32 characters, held only by
  Bradley. Missing or short, the admin route answers 404 while reviewer notes
  still record.

Use a strong shared passphrase for the password and an independently generated
high-entropy signing secret. Never place either value in GitHub source,
repository variables, workflow files, command arguments, chat, or logs. The
GitHub environment separately holds the least-privilege
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` used by Wrangler. The token
must include Account · Workers Scripts · Edit for the intended account and
Zone · Workers Routes · Edit scoped only to `bradleyberkman.com`.

`wrangler.main-preview.jsonc` requires the password gate, sends every static
asset through the Worker, and retains the 200-request UTC-day chat budget. A
missing password or missing/undersized signing secret fails closed with a
redacted 503.
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
listed Worker secrets and GitHub environment credentials. The post-merge wizard
must display the exact source run, main SHA, and sorted `dist/` digest before
the operator types `ACTIVATE`. That confirmation authorizes the wizard to set
the repository variable to exact `true` and dispatch the protected manual
workflow with only those three non-secret artifact identity inputs. The
operator must not add routes beyond the two listed zone routes, broaden token
permissions beyond the intended account and zone, substitute an
artifact, pass secret values as inputs or command arguments, or retain secret
values.

If exact `true` readback or the manual workflow dispatch fails, the wizard
performs a compensating write of `false` and requires exact `false` readback
before exiting nonzero. A `FAIL-CLOSED WARNING` naming
`PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED` means that compensation could not be
verified; stop and inspect the repository variable before any main push or
deployment attempt.

## Live smoke matrix

Run and record these checks on the deployed hostname, including one iPhone test
over cellular rather than home Wi-Fi:

| Check | Expected result |
| --- | --- |
| Signed-out apex | `https://bradleyberkman.com/` redirects to `/_portfolio-preview/login` and is marked `noindex, nofollow, noarchive` |
| Signed-out `www` | `https://www.bradleyberkman.com/` reaches the same password boundary |
| TLS | Both public hostnames present valid Cloudflare-managed certificates |
| Wrong password | Generic 401, no session cookie, and no configuration detail |
| Correct password | Redirects to the requested same-origin path and sets the seven-day secure cookie |
| Protected asset | Loads only after authentication and retains the `noindex, nofollow, noarchive` response header |
| iPhone over cellular | Password form, map, HTML index, and a record in the map reader load outside the home network |
| Chat | One grounded question reaches `/api/portfolio-chat` after login and remains within the 1,000/day budget |
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

Set `PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED` back to `false` before the next push
if automatic deployment must stop. If there is no healthy prior version and the
hostname must be contained, delete only this dedicated Worker:

```sh
npx wrangler delete bradley-portfolio-main-preview \
  --config wrangler.main-preview.jsonc
```

Do not use `--force`. Record the rollback or deletion, post-containment smoke,
and final variable state in the activation record.
