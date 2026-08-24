# Portfolio chat preview controls implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dormant closed-preview controls, privacy-safe telemetry, provider safety identity, portfolio-native prompts, and deterministic offline evaluation to the merged portfolio chat.

**Architecture:** A shared server runtime enforces access and resource controls before it delegates to the existing grounded streaming handler. Canonical App Router endpoints read Cloudflare bindings at request time. This branch implements the binding interfaces and budget class but intentionally leaves deployment-affecting bindings and migrations to the activation change. A provider-agnostic evaluator runs only with providers supplied by its caller.

**Tech Stack:** TypeScript, React 19, Vinext, Cloudflare Workers, Durable Objects, Vitest, OpenAI Responses API over fetch.

**Spec:** `docs/superpowers/specs/2026-08-24-portfolio-chat-preview-controls-design.md`

## Global constraints

- Portfolio evidence publishing is out of scope; consume merged selectors without editorial changes.
- No provider secret provisioning, live model call, spend, deployment, preview enablement, or public activation.
- Every sensitive capability remains false by default and fails closed before provider construction.
- Provider and preview secrets stay server-side and out of client assets and telemetry.
- Production code contains no deterministic fake answer provider.
- Chat and preview controls must never trigger the landing transition.

---

### Task 1: Preview sessions and preflight policy

**Files:**
- Create: `lib/server/portfolio-chat-launch.ts`
- Test: `lib/server/portfolio-chat-launch.test.ts`

**Interfaces:**
- Produces `createPortfolioChatLaunchGuard(options)`, `createPortfolioChatPreviewHandler(options)`, `PortfolioChatRuntimeConfig`, `PortfolioChatRateLimiter`, and sanitized telemetry event types.
- The guard returns either a redacted response or a verified context containing the session identifier and OpenAI safety identifier.

- [x] Write failing tests for false gates, missing configuration, preview denial, signed HttpOnly cookie issuance and expiry, Turnstile failure, stable rate-limit keying, dependency failure, bounded access requests, and telemetry redaction.
- [x] Run `npx vitest run lib/server/portfolio-chat-launch.test.ts` and confirm failures name missing launch behavior.
- [x] Implement bounded parsing, HMAC session, Siteverify adapter, limiter interfaces, redacted responses, and safe event construction.
- [x] Run the targeted test and confirm it passes.

### Task 2: Shared runtime, Cloudflare bindings, and provider identity

**Files:**
- Create: `lib/server/portfolio-chat-runtime.ts`
- Create: `lib/server/portfolio-chat-runtime.test.ts`
- Create: `worker/portfolio-chat-budget.ts`
- Create: `worker/portfolio-chat-budget.test.ts`
- Modify: `app/api/portfolio-chat/route.ts`
- Create: `app/api/portfolio-chat/preview/route.ts`
- Modify: `lib/server/portfolio-chat-provider.ts`
- Modify: `lib/server/openai-portfolio-provider.ts`
- Modify: `lib/server/openai-portfolio-provider.test.ts`
- Modify: `lib/server/portfolio-chat-handler.ts`
- Modify: `lib/server/portfolio-chat-handler.test.ts`

**Interfaces:**
- Consumes the Task 1 guard and preview handler.
- Produces `createPortfolioChatRuntime(env)` for canonical App Router callers.
- Extends provider input with optional `safetyIdentifier` and `onUsage` without changing answer delta output.

- [x] Write failing runtime tests proving the disabled path never constructs a provider, all preflight checks happen before construction, safe identity reaches the provider, and stream telemetry excludes content.
- [x] Write failing budget tests proving atomic UTC-day reset, exact limit rejection, stale-day failure, and malformed-input failure.
- [x] Extend provider tests first for `safety_identifier`, explicit reasoning effort, and completed-event usage reporting.
- [x] Run the targeted tests and confirm the expected failures.
- [x] Implement the shared runtime and provider changes.
- [x] Implement the dormant Durable Object budget class without deployment bindings or migrations.
- [x] Route both canonical App endpoints through the shared runtime.
- [x] Run all server, budget, and provider tests and confirm they pass.

### Task 3: Preview client, starter questions, and evidence chain

**Files:**
- Modify: `lib/portfolio-grounding.ts`
- Modify: `lib/portfolio-grounding.test.ts`
- Modify: `lib/portfolio-chat-client.ts`
- Modify: `lib/portfolio-chat-client.test.ts`
- Modify: `components/PortfolioChat.tsx`
- Modify: `components/PortfolioChat.test.tsx`
- Modify: `components/PortfolioExperience.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Adds optional chain role metadata to grounding evidence.
- Adds `requestPortfolioChatPreviewAccess(accessCode, options)`.
- Keeps `AskPortfolio` backward compatible while allowing an optional challenge token.

- [x] Write failing grounding tests for instinct, approach, and output labels derived from the merged projection.
- [x] Write failing client tests for preview access errors and cookie-based success.
- [x] Write failing component tests for starter-question submission, preview unlock, chain labels, and click/pointer containment across every new control.
- [x] Run targeted tests and confirm the failures.
- [x] Implement the minimal client and UI changes, reusing the existing chat panel and visual tokens.
- [x] Run the targeted tests and confirm they pass.

### Task 4: Deterministic offline evaluation

**Files:**
- Create: `lib/server/portfolio-chat-eval.ts`
- Test: `lib/server/portfolio-chat-eval.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces `runPortfolioChatEval(configuration, cases)` and `comparePortfolioChatEvalRuns(runs, pricingSnapshots?)`.
- Accepts a caller-supplied `PortfolioChatProvider`; it cannot load credentials or choose a live provider.

- [x] Write failing tests for grounded answer success, correct refusal, citation rejection, latency percentile, usage totals, optional price snapshots, and two-configuration comparison.
- [x] Run the eval test and confirm it fails because the evaluator does not exist.
- [x] Implement the evaluator and JSON-serializable report types.
- [x] Document the offline-only workflow, metrics, and explicit activation boundary.
- [x] Run the eval tests and confirm they pass.

### Task 5: Combined proof and delivery

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `tests/built-worker-chat.test.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Proves runtime gates fail closed through the built Worker under local workerd, and a production build with planted server-secret sentinels does not inline those values into any JavaScript, map, or manifest artifact.

- [x] Extend runtime proof for both disabled endpoints and missing-binding failure, then expand built secret-isolation proof.
- [x] Run targeted unit tests for every changed seam.
- [x] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm run test:rendered` on the final diff.
- [x] Inspect `git diff --check`, the staged diff, and `git diff origin/main...HEAD` for unrelated files or activation values.
- [ ] Commit explicit paths, publish the branch, and prepare a pull request under the configured bot identity when GitHub authentication is available.
