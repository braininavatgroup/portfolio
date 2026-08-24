# Portfolio chat preview activation packet

Status: BIV-317 authorizes one single-operator preview deployment. No deployment
has been recorded yet. Cloudflare reported that `bradley-portfolio-preview` did
not exist on 2026-08-24 at 16:51 America/New_York.

## Bound release

- Target Worker: `bradley-portfolio-preview`.
- Access boundary: the generated
  `bradley-portfolio-preview.<account-subdomain>.workers.dev` hostname returned
  by Wrangler. The URL is intentionally usable by anyone who obtains it.
- Routes: Workers.dev only. Do not add a custom domain, zone route, or public
  portfolio hostname.
- Operator: Bradley is the only intended visitor during this preview.
- Window: seven days from the successful deployment timestamp, unless Bradley
  ends or extends it first. Record the exact expiry with the deployment proof.
- Artifact: deploy the exact independently reviewed PR head after GitHub records
  that tree as merged to `main`. Record its commit before deployment.

## Runtime configuration

`wrangler.preview.jsonc` owns the non-secret release configuration:

| Setting | Value |
| --- | --- |
| `PORTFOLIO_CHAT_LIVE_ENABLED` | `true` |
| `PORTFOLIO_CHAT_PREVIEW_ENABLED` | `false` |
| `PORTFOLIO_CHAT_TURNSTILE_REQUIRED` | `false` |
| `PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT` | `200` |
| `OPENAI_PORTFOLIO_MODEL` | `gpt-5.4-2026-03-05` |
| `OPENAI_PORTFOLIO_REASONING_EFFORT` | `low` |

The existing provider ceiling remains 450 output tokens. Store
`OPENAI_API_KEY` only as an encrypted Worker secret. Do not configure the older
preview access code, session secret, Turnstile keys, chat route limiter, or
preview-attempt route limiter for this Worker.

The config binds `PORTFOLIO_CHAT_BUDGET` to
`PortfolioChatBudgetObject` and provisions it with the `v1`
`new_sqlite_classes` migration. This UTC-day budget is the provider spend
boundary for the solo preview.

## Proof before deployment

Record all proof against one commit:

1. `npm test`, `npm run lint`, `npx tsc --noEmit`, and
   `npm run test:rendered` pass.
2. `tests/preview-worker-config.test.mjs` confirms Wrangler accepts the built
   Worker, the SQLite migration, the Workers.dev-only route, and the absence of
   secret or access-stack configuration.
3. The deterministic offline evaluation passes.
4. Client and build artifacts contain none of the planted secret sentinels.
5. The exact-head pull request is approved, merged, and still matches the
   artifact selected for deployment.

## Live smoke matrix

After deployment, record the hostname, Worker version, deployment timestamp,
seven-day expiry, and each result below:

| Check | Expected result |
| --- | --- |
| Page | Workers.dev root returns the portfolio without a custom-domain route |
| Direct chat | A grounded question streams an answer without access code, cookie, Turnstile, or route-limiter configuration |
| Conversation | One follow-up uses at most six in-memory user and assistant messages; reload clears them |
| Budget | The Durable Object receives a limit of 200 and rejects exhaustion before provider construction |
| Provider failure | The route returns the redacted provider error contract without leaking upstream detail |
| Secret isolation | No key, prompt, answer, IP address, access token, or secret appears in client assets or structured telemetry |
| Disabled gate | A build of the same artifact with `PORTFOLIO_CHAT_LIVE_ENABLED=false` returns the disabled contract before provider construction |

The budget exhaustion and provider-failure checks use deterministic local or
isolated test inputs. They do not consume the live 200-request allowance merely
to force failure states.

## Containment and rollback

There is no previous deployment to restore. The first containment target is the
same immutable artifact with its live gate disabled:

```sh
npx wrangler deploy --config wrangler.preview.jsonc \
  --var PORTFOLIO_CHAT_LIVE_ENABLED:false \
  --message "BIV-317 preview kill switch"
```

Verify that `/api/portfolio-chat` returns the disabled response after this
command. If the hostname itself must stop serving, delete only the dedicated
Worker:

```sh
npx wrangler delete bradley-portfolio-preview \
  --config wrangler.preview.jsonc
```

Do not run `--force`. Record the contained or deleted state in BIV-317 before
closing the preview window.
