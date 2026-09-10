# Remove chat-specific preview mode implementation plan

> **For agentic workers:** Execute this plan task by task with test-driven development. Preserve the false live gate and do not deploy or activate the chat.

**Goal:** Remove the redundant chat-only preview unlock flow while preserving one fail-closed answer endpoint, the global provider budget, and dormant public abuse controls.

**Architecture:** `/api/portfolio-chat` remains the only chat endpoint. When `PORTFOLIO_CHAT_LIVE_ENABLED` is false, the runtime rejects before touching protected dependencies. An enabled pre-launch site may run without public controls. A future public configuration may separately require Turnstile and a route limiter, using an HMAC-pseudonymized Cloudflare connecting IP for limiter and provider safety identity; raw IPs never enter logs or provider inputs.

**Tech stack:** TypeScript, React 19, Vinext, Cloudflare Workers, Vitest, Node test runner, Wrangler.

**Spec:** [Linear BIV-321](https://linear.app/bradleys-workspace/issue/BIV-321/remove-chat-specific-preview-mode)

**Constraints:**

- Do not deploy, provision secrets, enable chat, or alter custom-domain routing.
- Preserve the existing global Durable Object daily budget and provider fail-closed behavior.
- Keep public Turnstile/rate limiting dormant behind explicit configuration.
- Remove the access-code endpoint, cookie/session contract, preview limiter binding, preview client, and preview UI.
- Historical implementation plans/specs remain historical records; update current source, operator documentation, and active configuration.

## Task 1: Simplify the launch guard around one endpoint

**Files:**

- Modify: `lib/server/portfolio-chat-launch.test.ts`
- Modify: `lib/server/portfolio-chat-launch.ts`

1. Replace signed-preview tests with failing tests for the false live gate, direct pre-launch mode, required public-control dependencies, Turnstile-before-limiter ordering, privacy-safe stable actor keying, rate exhaustion, and dependency failure.
2. Run `npx vitest run lib/server/portfolio-chat-launch.test.ts` and confirm the new public-control contract fails against the old session-based guard.
3. Delete preview cookie/access-code behavior and implement the smallest guard that satisfies the tests.
4. Re-run the focused test and commit the server guard slice.

## Task 2: Collapse the runtime to one handler

**Files:**

- Modify: `lib/server/portfolio-chat-runtime.test.ts`
- Modify: `lib/server/portfolio-chat-runtime.ts`
- Delete: `app/api/portfolio-chat/preview/route.ts`
- Modify: `tests/built-worker-chat.test.mjs`

1. Write failing runtime and built-worker assertions for one handler, no preview runtime surface, dormant public controls, and no registered `/api/portfolio-chat/preview` route.
2. Run the focused runtime test and record the expected failure.
3. Remove preview environment fields and `handlePreview`; map `PORTFOLIO_CHAT_IDENTIFIER_SECRET` only to the dormant public guard.
4. Delete the preview route and re-run runtime tests.

## Task 3: Remove the browser unlock flow

**Files:**

- Modify: `lib/portfolio-chat-client.test.ts`
- Modify: `lib/portfolio-chat-client.ts`
- Modify: `components/PortfolioChat.test.tsx`
- Modify: `components/PortfolioChat.tsx`
- Modify: `app/globals.css`

1. Replace preview-unlock expectations with failing assertions that chat errors remain ordinary errors and no access-code UI appears.
2. Run `npx vitest run lib/portfolio-chat-client.test.ts components/PortfolioChat.test.tsx` and confirm the old preview UI violates the new contract.
3. Remove the preview access client, component state/controller/form, and preview-only CSS.
4. Re-run the focused client/component tests and commit the browser slice.

## Task 4: Align active configuration and operator guidance

**Files:**

- Modify: `package.json`
- Modify: `tests/preview-worker-config.test.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `wrangler.preview.jsonc`
- Modify: `README.md`
- Modify: `docs/activation/portfolio-chat-preview-activation-packet.md`

1. Remove preview/session secret sentinels and assert the Worker configuration contains no chat-specific preview keys.
2. Document the site-level pre-launch boundary, one endpoint, daily budget, and separately dormant public controls.
3. Keep the current Worker disabled from production/custom-domain release; do not activate anything.

## Task 5: Verify, review, and deliver

1. Run focused tests for every changed module.
2. Run `npm test`, `npm run lint`, `npm run build`, `npm run postbuild`, and the rendered/built-worker checks against the exact head.
3. Attach a headless browser to one workspace server and verify the chat UI has no unlock form at desktop and mobile widths; capture scoped screenshots.
4. Inspect `git diff --check`, the emitted client assets, and the complete ticket diff.
5. Request an independent code review, fix verified findings test-first, and re-run the affected/full verification ladder.
6. Commit explicit paths with BIV-321 subjects, push every commit with the bot identity, open a bot-authored PR against `main`, wait for required checks, and move BIV-321 to Bradley Review with exact-head evidence.
