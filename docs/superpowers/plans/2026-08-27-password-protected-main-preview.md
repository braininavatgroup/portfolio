# Password-protected main preview implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dormant, password-protected Cloudflare Worker that can automatically serve the latest successfully tested `main` commit after separate activation.

**Architecture:** A focused Worker auth module wraps the existing Vinext entry point and gates every route, including static assets forced through the Worker. A new Wrangler config defines a separate Workers.dev-only deployment, while the existing CI workflow produces one tested artifact and contains a repository-variable-gated deploy job.

**Tech Stack:** TypeScript, Web Crypto, Vinext, Cloudflare Workers Static Assets, Wrangler 4.125.0, Vitest, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-27-password-protected-main-preview-design.md`

## Global constraints

- Worker name is exactly `bradley-portfolio-main-preview`.
- No custom domain, zone route, Cloudflare Access policy, logout route, or failed-login throttling.
- Authentication applies only when `PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED` equals `true`.
- Password and session secret values exist only as Cloudflare Worker secrets.
- Sessions last seven days and use `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
- Static assets set `binding: "ASSETS"` and `run_worker_first: true`.
- Deployment remains false-gated by `PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED` and is not activated in this plan.
- The existing `bradley-portfolio-preview` Worker and BIV-317 activation packet remain unchanged.
- Preserve the unrelated uncommitted `vite.config.ts` Tailscale hostname change and exclude it from commits.

---

### Task 1: Password and session boundary

**Files:**
- Create: `worker/main-preview-auth.test.ts`
- Create: `worker/main-preview-auth.ts`

**Interfaces:**
- Consumes: `Request`, `PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED`, `PORTFOLIO_MAIN_PREVIEW_PASSWORD`, and `PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET`.
- Produces: `withMainPreviewPassword(request, env, next, now?) => Promise<Response>` and `MainPreviewAuthEnv`.

- [ ] **Step 1: Write failing public-behavior tests**

Cover disabled pass-through, missing-secret 503, unauthenticated navigation redirect, inline login page, non-navigation JSON 401, wrong-password 401, correct-password cookie and redirect, valid-cookie pass-through, tampered/expired cookie rejection, safe return paths, bounded request bodies, and noindex headers.

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run worker/main-preview-auth.test.ts`

Expected: FAIL because `worker/main-preview-auth.ts` does not exist.

- [ ] **Step 3: Implement the minimal gate**

Implement this public interface:

```ts
export interface MainPreviewAuthEnv {
  PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED?: string;
  PORTFOLIO_MAIN_PREVIEW_PASSWORD?: string;
  PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET?: string;
}

export async function withMainPreviewPassword(
  request: Request,
  env: MainPreviewAuthEnv,
  next: () => Promise<Response>,
  now: () => number = Date.now,
): Promise<Response>;
```

Use a 4 KiB streaming body limit, URL-encoded form parsing, SHA-256 plus timing-safe comparison, HMAC SHA-256 cookies, same-origin return-path validation, a seven-day expiry, generic errors, and streamed response wrapping that adds `X-Robots-Tag` without buffering bodies.

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run: `npx vitest run worker/main-preview-auth.test.ts`

Expected: all password and session tests pass.

### Task 2: Gate the Worker and static assets

**Files:**
- Modify: `worker/index.ts`
- Modify: `tests/built-worker-chat.test.mjs`

**Interfaces:**
- Consumes: `withMainPreviewPassword`, generated Worker bindings, `env.ASSETS.fetch`, image optimization, and the Vinext handler.
- Produces: one Worker fetch path where the password boundary runs before application, image, asset, and API dispatch.

- [ ] **Step 1: Add failing built-Worker boundary tests**

Prove an unauthenticated asset never calls `ASSETS.fetch`, an authenticated asset can be served from the asset binding, and disabled auth preserves the existing chat route behavior.

- [ ] **Step 2: Build and verify RED**

Run: `npm run build && node --test tests/built-worker-chat.test.mjs`

Expected: the new asset-gating assertions fail because `worker/index.ts` does not wrap dispatch or serve bound assets after authentication.

- [ ] **Step 3: Integrate the gate and asset fallback**

Extend generated binding types instead of adding an untyped environment. Move existing image and Vinext dispatch into a `serveApplication` function. For authenticated `GET` and `HEAD` requests, return a non-404 `env.ASSETS.fetch(request)` response before falling back to Vinext. Wrap dispatch with `withMainPreviewPassword`.

- [ ] **Step 4: Rebuild and verify GREEN**

Run: `npm run build && node --test tests/built-worker-chat.test.mjs`

Expected: existing chat tests and new password/asset tests pass.

### Task 3: Separate main-preview Worker contract

**Files:**
- Create: `wrangler.main-preview.jsonc`
- Create: `worker-configuration.main-preview.d.ts`
- Create: `tests/main-preview-worker-config.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `dist/server/index.js`, `dist/client`, `PortfolioChatBudgetObject`, and three declared secrets.
- Produces: a dry-run-valid Workers.dev-only `bradley-portfolio-main-preview` config and generated binding types.

- [ ] **Step 1: Write the failing configuration test**

Assert the exact Worker name, no routes/domains, auth-required variable, current chat vars, required secrets, budget binding/migration, explicit asset binding, `run_worker_first: true`, observability, and absence of literal secret values. Spawn Wrangler dry-run against the built artifact.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/main-preview-worker-config.test.mjs`

Expected: FAIL because `wrangler.main-preview.jsonc` does not exist.

- [ ] **Step 3: Add config, generated bindings, and rendered-test ownership**

Create the JSONC config with compatibility date `2026-08-27`, `nodejs_compat`, Workers.dev only, preview URLs disabled, password gate required, the current model/budget settings, required secrets, existing Durable Object migration, `no_bundle`, and authenticated static assets. Generate types with:

```bash
npx wrangler types worker-configuration.main-preview.d.ts \
  --config wrangler.main-preview.jsonc
```

Add the config test to `test:rendered` after the build.

- [ ] **Step 4: Build and verify GREEN**

Run: `npm run build && node --test tests/main-preview-worker-config.test.mjs`

Expected: contract assertions and Wrangler dry run pass.

- [ ] **Step 5: Check generated types are current**

Run: `npx wrangler types worker-configuration.main-preview.d.ts --config wrangler.main-preview.jsonc --check`

Expected: exit 0.

### Task 4: Dormant tested-main deployment automation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `tests/main-preview-workflow.test.mjs`
- Create: `docs/activation/portfolio-main-preview-activation-packet.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: exact `dist/` produced by CI, GitHub environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and repository variable `PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED`.
- Produces: a false-gated deploy job and an exact-artifact activation/rollback contract.

- [ ] **Step 1: Write the failing workflow behavior test**

Parse `.github/workflows/ci.yml` and prove the deploy job needs CI, runs only on a `main` push with the repository variable equal to `true`, uses the `portfolio-main-preview` environment, downloads the CI artifact, and deploys `wrangler.main-preview.jsonc`. Use a YAML parser and semantic assertions rather than source grep.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/main-preview-workflow.test.mjs`

Expected: FAIL because no deploy job or artifact handoff exists.

- [ ] **Step 3: Add artifact handoff and false-gated deploy job**

On pushes to `main`, upload `dist/` after rendered proof. Add a deploy job with `needs: ci`, the false gate, read-only contents permission, protected GitHub environment, checkout/setup/npm install, artifact download, digest output, and `cloudflare/wrangler-action@v3` using only environment secrets. Do not add secret values or enable the repository variable.

- [ ] **Step 4: Write the activation packet and README guidance**

Document required independent review, exact commit and digest, Worker version, hostname, three secret names, password/session-secret rotation, iPhone smoke, chat budget smoke, rollback, deletion containment, and explicit activation approval. Keep the BIV-317 packet unchanged.

- [ ] **Step 5: Run the workflow test and verify GREEN**

Run: `node --test tests/main-preview-workflow.test.mjs`

Expected: pass with the false gate and exact artifact dependency present.

### Task 5: Combined proof and dormant handoff

**Files:**
- Verify all paths from Tasks 1 through 4 plus this plan and its spec.

**Interfaces:**
- Produces: reviewed source and automation that remain dormant until separately activated.

- [ ] **Step 1: Run focused and full proof**

```bash
npm test
npm run lint
npx tsc --noEmit
npm run test:dev-start
npm run test:worktree-bootstrap
npm run test:rendered
npx wrangler types worker-configuration.main-preview.d.ts --config wrangler.main-preview.jsonc --check
git diff --check
```

Expected: zero failures, no secret values in source or artifacts, and no live Cloudflare calls.

- [ ] **Step 2: Review the full diff against the spec**

Confirm no logout/throttling, no custom domain, no old-preview change, no production access, no secret material, no activation, and no inclusion of the unrelated `vite.config.ts` change.

- [ ] **Step 3: Run the Workers best-practices review**

Check generated binding types, streamed responses, awaited promises, request-local state, timing-safe comparison, HMAC verification, error redaction, secret declarations, asset routing, and observability.

- [ ] **Step 4: Stop at the activation boundary**

Report the residual actions: independent review and merge, create the GitHub environment and least-privilege Cloudflare token, provision the three Worker secrets through a separately authorized operator, set the repository variable, deploy the exact merged commit, run the iPhone/chat smoke matrix, and record rollback evidence.
