# Single-operator portfolio chat preview implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the grounded portfolio chat to a dedicated `bradley-portfolio-preview` Workers.dev hostname with no access-code flow, a 200-request UTC-day provider cap, and no public/custom-domain route.

**Architecture:** `PORTFOLIO_CHAT_LIVE_ENABLED=true` with `PORTFOLIO_CHAT_PREVIEW_ENABLED=false` selects the direct single-operator path on the dedicated Worker. The older cookie, Turnstile, and route-limiter path remains unchanged when preview mode is enabled. A source-controlled Wrangler config binds the existing budget Durable Object, while the OpenAI key remains an encrypted Worker secret.

**Tech Stack:** TypeScript, React 19, Vinext, Cloudflare Workers, Wrangler 4, Durable Objects, Vitest, Node test runner.

**Spec:** `docs/activation/portfolio-chat-preview-activation-packet.md` and Linear issue BIV-317.

## Global constraints

- Worker name is exactly `bradley-portfolio-preview` and only its generated Workers.dev hostname is enabled.
- No custom domain, zone route, access code, preview cookie, Turnstile binding, or Cloudflare route-limiter binding is required for this solo preview.
- `OPENAI_PORTFOLIO_MODEL=gpt-5.4-2026-03-05`, `OPENAI_PORTFOLIO_REASONING_EFFORT=low`, `PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT=200`, and the existing 450-token output ceiling remain fixed.
- `OPENAI_API_KEY` is an encrypted Worker secret and never appears in source, generated client assets, logs, or command output.
- The Durable Object uses a `new_sqlite_classes` migration. The config does not use the mutually exclusive declarative `exports` field.
- Production/custom-domain deployment remains untouched.

---

### Task 1: Direct single-operator launch path

**Files:**
- Modify: `lib/server/portfolio-chat-runtime.test.ts`
- Modify: `lib/server/portfolio-chat-launch.ts`
- Modify: `lib/server/portfolio-chat-handler.ts`

**Interfaces:**
- Consumes: `PORTFOLIO_CHAT_LIVE_ENABLED` and `PORTFOLIO_CHAT_PREVIEW_ENABLED` from `PortfolioChatRuntimeEnv`.
- Produces: `PortfolioChatLaunchResult` with optional `safetyIdentifier`; direct mode omits it, while the signed preview path still returns the stable `pc_` identifier.

- [x] **Step 1: Write the failing runtime test**

Add a test that creates the real runtime with live enabled, preview disabled, no access/session/Turnstile/limiter bindings, a real budget namespace fake, and a provider fake. Submit a grounded question and assert a `200` stream, one budget consumption with `{ limit: 200 }`, and an undefined provider safety identifier.

```ts
it("serves the dedicated live Worker without the older preview access stack", async () => {
  const seenSafetyIdentifiers: Array<string | undefined> = [];
  const provider: PortfolioChatProvider = {
    async *streamAnswer({ safetyIdentifier }) {
      seenSafetyIdentifiers.push(safetyIdentifier);
      yield "The final approval remains human. [E1]";
    },
  };
  const consume = vi.fn(async () => ({ success: true }));
  const { namespace } = budgetNamespace(consume);
  const runtime = createPortfolioChatRuntime({
    env: {
      PORTFOLIO_CHAT_LIVE_ENABLED: "true",
      PORTFOLIO_CHAT_PREVIEW_ENABLED: "false",
      PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "200",
      OPENAI_API_KEY: "sk-server-only",
      OPENAI_PORTFOLIO_MODEL: "gpt-5.4-2026-03-05",
      OPENAI_PORTFOLIO_REASONING_EFFORT: "low",
      PORTFOLIO_CHAT_BUDGET: namespace,
    },
    getProvider: () => provider,
    randomId: () => "direct-request",
    record: () => {},
  });

  const response = await runtime.handleChat(chatRequest());

  expect(response.status).toBe(200);
  expect(await response.text()).toContain('"type":"answer_delta"');
  expect(consume).toHaveBeenCalledWith({ limit: 200 });
  expect(seenSafetyIdentifiers).toEqual([undefined]);
});
```

- [x] **Step 2: Run the targeted test and verify RED**

Run: `npx vitest run lib/server/portfolio-chat-runtime.test.ts`

Expected: the new test fails with HTTP `503` and `misconfigured` because the launch guard still requires the signed preview stack.

- [x] **Step 3: Implement the minimal direct branch**

In `createPortfolioChatLaunchGuard`, after the live gate and request ID are established, allow requests when preview mode and Turnstile are both disabled. Keep the existing preview configuration, cookie, Turnstile, and limiter checks unchanged for `previewEnabled=true`. Make `safetyIdentifier` optional in both launch and request context so direct mode can forward no identifier.

```ts
if (!config.previewEnabled) {
  if (config.turnstileRequired) {
    return reject(503, "misconfigured", "Ask the portfolio is not configured.");
  }
  return { ok: true, requestId };
}
```

- [x] **Step 4: Run the targeted test and verify GREEN**

Run: `npx vitest run lib/server/portfolio-chat-runtime.test.ts lib/server/portfolio-chat-launch.test.ts`

Expected: both files pass, including the existing signed-preview identity tests.

### Task 2: Dedicated Worker and budget migration

**Files:**
- Create: `wrangler.preview.jsonc`
- Modify: `worker/index.ts`
- Create: `tests/preview-worker-config.test.mjs`
- Modify: `package.json`
- Modify: `eslint.config.mjs`

**Interfaces:**
- Consumes: `dist/server/index.js` and `dist/client` from `npm run build`.
- Produces: a deployable `bradley-portfolio-preview` Worker config with a `PORTFOLIO_CHAT_BUDGET` binding to exported class `PortfolioChatBudgetObject`.

- [x] **Step 1: Write the failing deployment-config test**

Parse `wrangler.preview.jsonc` as JSON, assert the fixed runtime values, absence of routes and secret fields, exact Durable Object binding, and `new_sqlite_classes` migration. Spawn Wrangler against the built artifact with `deploy --dry-run --config wrangler.preview.jsonc --outdir .wrangler/preview-dry-run` and require exit code zero.

- [x] **Step 2: Run the test and verify RED**

Run: `node --test tests/preview-worker-config.test.mjs`

Expected: failure because `wrangler.preview.jsonc` does not exist.

- [x] **Step 3: Add the Worker config and class export**

Create a JSONC config with these operative fields:

```json
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "bradley-portfolio-preview",
  "main": "dist/server/index.js",
  "compatibility_date": "2026-08-24",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  "preview_urls": false,
  "vars": {
    "PORTFOLIO_CHAT_LIVE_ENABLED": "true",
    "PORTFOLIO_CHAT_PREVIEW_ENABLED": "false",
    "PORTFOLIO_CHAT_TURNSTILE_REQUIRED": "false",
    "PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT": "200",
    "OPENAI_PORTFOLIO_MODEL": "gpt-5.4-2026-03-05",
    "OPENAI_PORTFOLIO_REASONING_EFFORT": "low"
  },
  "durable_objects": {
    "bindings": [{ "name": "PORTFOLIO_CHAT_BUDGET", "class_name": "PortfolioChatBudgetObject" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["PortfolioChatBudgetObject"] }],
  "rules": [{ "type": "ESModule", "globs": ["**/*.js", "**/*.mjs"] }],
  "no_bundle": true,
  "assets": { "directory": "dist/client" },
  "observability": { "enabled": true }
}
```

Export the existing class from `worker/index.ts`, then add the new config test to `test:rendered` so CI validates the deploy artifact after every production build.

- [x] **Step 4: Build and verify GREEN**

Run: `npm run build && node --test tests/preview-worker-config.test.mjs`

Expected: build, contract assertions, and Wrangler dry-run all pass.

### Task 3: Activation packet and local release proof

**Files:**
- Modify: `docs/activation/portfolio-chat-preview-activation-packet.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: BIV-317’s accepted target, model, budget, access boundary, and rollback conditions.
- Produces: the current release record template for the dedicated Worker, including blank runtime-evidence fields that are filled only from actual deployment output.

- [x] **Step 1: Replace the stale dormant-only contract and owning README guidance**

Document the exact Worker name, immutable source commit and build digest, Workers.dev-only boundary, non-secret vars, OpenAI secret name, `v1` SQLite migration, verification matrix, expiry field, disabled version field, and exact version rollback/delete commands. Correct the README's stale dormant-only description. Remove the obsolete requirement for access code, preview cookie, Turnstile, and route limiters from this solo activation packet while preserving their description as the unused older path.

- [x] **Step 2: Check the packet and repository diff**

Run: `git diff --check && git diff -- docs/activation/portfolio-chat-preview-activation-packet.md`

Expected: no whitespace failures; the packet contains no secret value and no public/custom-domain route.

### Task 4: Combined verification and delivery

**Files:**
- Verify all files changed by Tasks 1 through 3.

**Interfaces:**
- Produces: one exact-head PR that references BIV-317 and leaves the live deployment and closeout proof as the exact residual.

- [x] **Step 1: Run focused and full proof**

Run:

```sh
npm test
npm run lint
npx tsc --noEmit
npm run test:rendered
git diff --check
```

Expected: zero failures and no secret sentinel in client or build artifacts.

- [x] **Step 2: Inspect and commit explicit paths**

Inspect `git status`, `git diff`, and the staged diff. Commit only the plan, direct launch change, config, config test, Worker export, package script, and activation packet using the repository’s bot identity and ticket convention.

- [ ] **Step 3: Rebase-check, push, and open the exact-head PR**

Fetch `origin/main`, verify the affected seams against the current base, push the branch through the short-lived GitHub App identity, validate the PR body with the Linear workflow validator, and open a `Refs BIV-317` PR. Protected effects must name the accepted BIV-317 activation target. Residual must name the exact deployment, smoke proof, and Linear closeout.

- [ ] **Step 4: Wait for CI and independent review**

Verify CI against the pushed head. Do not merge as Bradley or deploy a commit that lacks the required independent review.

- [ ] **Step 5: Deploy and prove the approved immutable artifact**

After the exact-head PR is approved and merged, build that merged commit, deploy `wrangler.preview.jsonc` with `OPENAI_API_KEY` supplied from the approved secret source, record the returned Worker version and hostname, and run disabled/live, budget, provider-failure, secret-isolation, and rollback smoke checks. Leave the final state live only if every check passes; otherwise set `PORTFOLIO_CHAT_LIVE_ENABLED=false` or roll back to the recorded prior version.
