# Portfolio chat preview controls design

## Status

Approved for dormant implementation under BIV-308. Portfolio evidence publishing is a separate workstream.

## Goal

Prepare the merged portfolio chat for a controlled preview without enabling it. Add bounded access, abuse and spend containment, privacy-safe telemetry, provider identity protection, and deterministic offline evaluation. Preserve the existing grounding, attribution, streaming, failure, secret-isolation, and click-containment contracts.

## Runtime shape

The Vinext App Router routes are canonical. They read Cloudflare bindings through `cloudflare:workers` and delegate to one shared runtime for `/api/portfolio-chat` and `/api/portfolio-chat/preview`. The runtime checks the live gate first and never constructs the provider while disabled.

When the live gate is enabled, a preview-mode request must carry a valid signed HttpOnly session cookie. The preview endpoint exchanges a server-held access code for that cookie. The session contains a random opaque identifier and expiry, signed with HMAC SHA-256. Its identifier becomes a one-way, privacy-preserving OpenAI `safety_identifier`; no access code, cookie, raw question, or answer enters telemetry.

After access succeeds, the runtime parses one bounded request, optionally validates a single-use Turnstile token with Siteverify, and applies the Cloudflare route limiter using the preview session identifier. It grounds the valid question before it consumes one request from a UTC-day Durable Object budget immediately before provider construction. Malformed and evidence-free questions cannot spend the provider budget. A missing required binding, invalid configuration, failed challenge, exhausted limit, or exhausted budget fails closed before provider construction.

The rate limiter controls bursts. It is not spend accounting. The Durable Object budget caps the number of provider requests per UTC day. Activation must supply the limit explicitly; there is no permissive default.

## Gates and server-only configuration

- `PORTFOLIO_CHAT_LIVE_ENABLED` must equal `true`.
- `PORTFOLIO_CHAT_PREVIEW_ENABLED` must equal `true` for the BIV-308 preview path.
- `PORTFOLIO_CHAT_PREVIEW_ACCESS_CODE` and `PORTFOLIO_CHAT_SESSION_SECRET` stay server-side. The runtime rejects access codes shorter than 24 characters and signing secrets shorter than 32 characters.
- `PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT` must be a positive integer.
- `PORTFOLIO_CHAT_TURNSTILE_REQUIRED` defaults false. When true, `TURNSTILE_SECRET_KEY` and a request token are required.
- `OPENAI_API_KEY`, `OPENAI_PORTFOLIO_MODEL`, and optional `OPENAI_PORTFOLIO_REASONING_EFFORT` stay server-side.
- Missing configuration returns a redacted `503 misconfigured` response and never constructs the provider.

No committed configuration value enables the feature. No production rate-limit binding, Durable Object binding, or migration is added in BIV-308 because a later deployment would provision those resources even while the application gate stayed false. The activation change must add them. No secret or real account identifier appears in source, fixtures, logs, or client assets.

## Public contracts

The chat endpoint keeps its NDJSON stream. Preflight failures use JSON:

- `503 disabled`
- `401 preview_required`
- `403 challenge_failed`
- `429 rate_limited`
- `503 budget_exhausted`
- `503 misconfigured`

The preview endpoint accepts same-origin bounded POST requests containing `{ "accessCode": "..." }`, returns a redacted success document, and sets the HttpOnly session cookie. A separate limiter protects access attempts with an HMAC-pseudonymized Cloudflare connecting-actor key; the raw address is never logged or sent to the provider. Missing trusted connecting-actor context fails closed. Invalid access returns `401 preview_denied`.

The chat request accepts `{ "question": "...", "conversation"?: [...], "challengeToken"?: "..." }`. The optional conversation contains at most six recent user/assistant messages and 6,000 characters. The runtime parses the bounded body once and passes the validated question, conversation context, and token through preflight and into the grounded handler. Conversation context is untrusted follow-up context, never portfolio evidence.

## Privacy-safe telemetry

One structured event records each rejected preflight or completed stream. Allowed fields are event name, request ID, outcome, evidence IDs, evidence count, duration, answer character count, provider model label, input tokens, output tokens, and total tokens. Telemetry never records request bodies, questions, answers, cookies, access codes, Turnstile tokens, IP addresses, provider keys, upstream bodies, or exception messages.

## Offline evaluation

The evaluator accepts named provider configurations through the existing provider interface and runs a fixed set of questions with explicit expected-answer anchors. It accepts conversational uncertainty, validates any citations that are present, enforces evidence required by individual cases, and records provider completion, latency, and usage. A report compares pass count, average and p95 latency, token totals, and optional cost estimates supplied from an explicit pricing snapshot.

Tests use deterministic providers. Production code contains no fake or fallback answer provider. The evaluator never discovers or calls a live provider by itself.

## Portfolio-native UI

The chat keeps one bounded conversation per browser visit. React memory holds at most six recent user/assistant messages and sends them with each follow-up; it does not use localStorage, a database, a conversation ID, or durable provider state. Reloading the page or starting a new visit clears the context. Prior turns help resolve follow-up references only; current grounded evidence remains the sole factual source. Curated starter questions submit through the same client function as typed questions. Supporting evidence displays its project-chain role when available. Preview denial reveals a compact access-code form; success stores only the HttpOnly cookie and asks the visitor to resubmit. Every chat and preview control stays inside the existing event-containment boundary so it cannot start the landing transition.

The request and server-validation contracts accept Turnstile tokens, validate the `portfolio_chat` action and request hostname, and enforce a five-second Siteverify timeout. BIV-308 intentionally does not ship or configure a browser widget. Client widget integration and test-key proof remain activation prerequisites; setting `PORTFOLIO_CHAT_TURNSTILE_REQUIRED=true` before that work fails closed.

## Activation boundary

BIV-308 ends with dormant code and automated proof. A later activation change must provision secrets and bindings, add the Durable Object migration, integrate the Turnstile client widget, choose the request budget and model, run the offline comparison with authorized provider access, deploy an immutable artifact, smoke-test it, and retain a rollback or kill-switch path.
