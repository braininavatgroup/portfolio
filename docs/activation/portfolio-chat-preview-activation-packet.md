# Portfolio chat preview activation packet

Status: dormant preparation only. This packet does not authorize provisioning,
deployment, preview access, public exposure, or provider spend.

## Prepared surface

- The client renders an explicit Cloudflare Turnstile widget only when
  `VITE_PORTFOLIO_CHAT_TURNSTILE_SITE_KEY` is present. The default is absent,
  so the merged application remains unchanged and dormant.
- A verified browser token is sent as `challengeToken` and the widget resets
  after each request. The server-side verifier remains controlled by
  `PORTFOLIO_CHAT_TURNSTILE_REQUIRED` and fails closed when required material
  is missing or invalid.
- The shared runtime already exposes typed contracts for the route limiters
  and the `PORTFOLIO_CHAT_BUDGET` Durable Object namespace. No production
  binding, migration, secret, or real site key is committed here.

## Activation inputs to choose and authorize

Record the exact values in the deployment change or its protected release
record; never add them to this repository:

| Input | Required decision |
| --- | --- |
| Target hostname(s) | Exact preview hostnames allowed by the Turnstile site key and smoke test |
| `VITE_PORTFOLIO_CHAT_TURNSTILE_SITE_KEY` | Public site key restricted to the target hostname(s) |
| `TURNSTILE_SECRET_KEY` | Server-only secret for the matching site key |
| `PORTFOLIO_CHAT_LIVE_ENABLED` | Keep `false` until the private-preview smoke test is ready |
| `PORTFOLIO_CHAT_PREVIEW_ENABLED` | Set `true` only for the authorized preview window |
| `PORTFOLIO_CHAT_PREVIEW_ACCESS_CODE` | Server-only high-entropy access code, at least 24 characters |
| `PORTFOLIO_CHAT_SESSION_SECRET` | Server-only signing secret, at least 32 characters |
| `PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT` | Explicit UTC-day provider budget; no permissive default |
| `OPENAI_API_KEY` / `OPENAI_PORTFOLIO_MODEL` | Server-only provider configuration and approved model |
| `PORTFOLIO_CHAT_TURNSTILE_REQUIRED` | `true` for the authorized preview after widget proof |
| Cloudflare route limiters | Provision and bind both chat and preview-attempt limiters |
| `PORTFOLIO_CHAT_BUDGET` | Provision the Durable Object namespace and migration before enabling provider calls |

## Required proof before enabling the preview

1. Run the full repository verification suite and the deterministic offline
   evaluation. Record the exact artifact, commit, model label, request limit,
   and evaluation report.
2. Verify the Turnstile test-key flow in a browser on the exact target
   hostname: no token blocks submission, a valid token reaches the server, an
   expired token blocks the next request, and the widget resets after use.
3. Verify the private preview with a bounded smoke matrix: disabled response,
   preview denial, valid access-cookie exchange, challenge failure, rate-limit
   rejection, budget exhaustion, grounded answer, and provider failure. Confirm
   no secret, token, access code, question, answer, or address appears in
   client assets or telemetry.
4. Confirm the kill switch by setting the live gate false in a reversible
   configuration change, then retain the previous immutable artifact and the
   exact rollback command in the release record.

## Release boundary

Only a separately authorized release may provision the listed Cloudflare
resources, store secrets, deploy an immutable artifact, or enable the preview.
The person or runner receiving that authorization must have only the scoped,
short-lived capability needed for that release. A code review or merge of this
preparation does not itself activate the chat.
