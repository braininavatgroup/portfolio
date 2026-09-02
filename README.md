# Bradley Berkman portfolio

An experimental spatial portfolio for Bradley Berkman's product, systems, and creative technology work. The main view turns portfolio records and threads into an explorable map with a shared reader; the flat HTML index links into that same reading surface.

## Run it

Requires Node.js 22.13 or newer.

```bash
bash scripts/bootstrap-worktree.sh
npm run setup:chat # once per Mac
npm run dev
```

The development server prints its local URL, normally `http://localhost:3000`.
Conductor and manually created Git worktrees use the same idempotent bootstrap
script. It runs `npm ci` when the lockfile or Node version changes, then records
that dependency state inside the worktree. Conductor setup also activates the
versioned `post-checkout` hook, so later `git worktree add` operations bootstrap
their own dependencies automatically. Workspaces can run concurrently because
Wrangler and Miniflare keep their state inside each worktree.
The setup wizard opens the OpenAI project page and separates the credentials:

- The `portfolio-dev` key lives in macOS Keychain under service
  `biv-openai-portfolio-dev`; every Conductor workspace reads it automatically.
- The `portfolio-production` service-account key is uploaded only after an
  explicit confirmation and lives as Cloudflare's encrypted
  `OPENAI_API_KEY` Worker secret.

The repeatable two-stage wizard captures both keys with hidden terminal input.
It authenticates the development key before replacing the existing Keychain
item, reads it back to verify that the complete value was preserved, and rolls
the prior value back if storage verification fails. The production key remains
in memory only long enough to validate it and stream it directly to Wrangler.

No key is copied into a workspace, `.env` file, generated BStack release, or
command argument. An explicit `OPENAI_API_KEY` process variable still overrides
Keychain for CI and non-macOS environments.

In development, press `Shift+A` to toggle the Avatar Director over the live
portfolio canvas. Press `Shift+G` to open game mode over that same canvas.
Neither mode adds a resting UI control or navigates to an isolated page, and
both preserve the current map, reader, chat, and history state.

## Routes

- `/` contains the spatial map, shared reader, portfolio chat, and embodied assistant.
- `/index` is the complete HTML index of threads and nodes and works without WebGL.
- `/index/[id]` redirects a canonical record ID into the corresponding map reader state.

## Content model

A **node** is a dot on the map. Opening one reads one of two authored content types: a **record** (the short piece for one thing in the map reader) or a **thread** (a narrated path through the map; the only long-form type). Authored text lives in `content/portfolio-content.json`; `lib/portfolio-structure.ts` owns IDs, relationships, positions, and block order; and `lib/portfolio-world.ts` validates and combines them into the runtime model. Record and Thread bodies interleave prose with structured copy and visual placeholders while the portfolio is being composed. A paragraph may link a phrase to another record or thread (`[phrase](record:<id>)`, `[phrase](thread:<id>)`) or to an outside address (`[phrase](https://…)`), and lines beginning with `- ` render as a bulleted list. Visual blocks support image, video, and gallery formats; selecting one opens it at useful scale in the map pane and returns to the same record when closed. Placeholders intentionally render on `main`, and `?review=clean` hides them for a clean reading pass without forking the content. Chat-only facts (audience statement, career timeline, private context) live in `lib/portfolio-private-grounding.ts` and are never rendered in the UI. Grounding labels workbench placeholders as draft context rather than published proof.

`lib/avatar` owns the embodied assistant's validated command contract, semantic target registry, obstacle-aware CSS-pixel stage layout, controller, behavior director, sequence runner, and bounded tone mappings. Safe movement commands include `swimTo` for a semantic target and `swimRoute` with the repository-owned `lap` route. `components/avatar` owns the lazy overlay, Director console, and replaceable GLB/procedural renderer. See [Embodied portfolio agent](docs/embodied-portfolio-agent.md) for architecture, controls, troubleshooting, and the proof boundary.

## Evidence policy

The prototype never invents campaign counts, outcomes, artist photos, screenshots, release links, or handoff proof; a piece that leans on unpublished material says so in its prose or leaves it out. The current CC0 Quaternius game character is a stand-in for Bradley's final 3D model; the procedural figure remains the no-asset fallback.

Inputs still needed for a production version include the real 3D model, roster press photos and verified campaign count, current resume, representative music outcomes, consulting before-and-afters, Dubs and Writ builds, and the Yoohoo interface.

## Portfolio chat launch controls

The model-backed chat has one canonical App Router endpoint,
`/api/portfolio-chat`, and no enable/disable gate. In every configured local or
deployed environment, submitting a message reaches the provider. A missing key,
model, request budget, or Durable Object binding is reported as a configuration
error before provider construction rather than silently disabling chat.

During pre-launch, access to the portfolio is a deployment-boundary concern rather than a second authentication flow inside chat. The dedicated site-preview Worker is reachable only at the generated `bradley-portfolio-preview.<account-subdomain>.workers.dev` hostname. Chat still retains the global Durable Object request budget, bounded request bodies, a 15-second provider timeout, and privacy-safe telemetry. Telemetry contains result codes, timing, evidence IDs, answer length, model label, and token usage. It excludes raw questions, answers, Turnstile tokens, IP addresses, provider keys, upstream bodies, and exception messages.

Future public launch controls remain dormant and independent: setting `PORTFOLIO_CHAT_TURNSTILE_REQUIRED=true` requires Turnstile, a Cloudflare route limiter, and a server-only `PORTFOLIO_CHAT_IDENTIFIER_SECRET`. The runtime HMAC-pseudonymizes the trusted Cloudflare connecting IP before using it as a limiter key or OpenAI `safety_identifier`; raw IPs are never forwarded or logged. Leaving the setting false touches none of those capabilities.

The provider is one OpenAI Agents SDK text agent with one model turn and no
tools, handoffs, or persistent session. Its instructions define the
portfolio-guide task, and every run receives the complete published portfolio
evidence plus the bounded transcript from the current browser visit. The agent
always answers conversationally: published Bradley facts can carry citations,
unknown Bradley details get a natural statement of uncertainty, social chat
stays open-ended, and the application owns the one-time third-general-turn
nudge. Its structured result also selects one to three known avatar behaviors,
a bounded performance intent, and enum-valued tone. The client holds that
direction until the first answer text commits. SDK tracing and OpenAI response
storage are disabled so this adoption does not broaden the telemetry or
retention contract. The SDK's optional MCP packages remain installed for future
agent tools; local Vite development only excludes their browser-only PKCE helper
from Workerd's eager dependency optimizer.

`wrangler.preview.jsonc` owns the site-preview Worker's non-secret
configuration: model `gpt-5.6-terra` with medium reasoning, a 200-request
UTC-day Durable Object budget, its SQLite migration, dormant public controls,
and no custom-domain route. It declares `OPENAI_API_KEY` as a required encrypted
Worker secret. The local Vite Worker supplies the same model, budget, and
Durable Object bindings while `npm run dev` injects the separate Keychain-backed
development key.

The separate permanent preview of tested `main` is defined by
`wrangler.main-preview.jsonc`. It uses a normal password form and a signed
seven-day browser cookie, gates static assets as well as application routes,
and serves `bradleyberkman.com` plus `www.bradleyberkman.com` as Cloudflare
Worker Routes in front of the zone's existing proxied web records. Its CI
deployment job consumes the exact `dist/`
artifact already proven by CI and remains dormant unless the repository
variable `PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED` is explicitly set to `true`.

Public-domain builds enable Microsoft Clarity project `yatoiqtrjm` for
privacy-safe behavioral analytics on every visit to `bradleyberkman.com` and
`www.bradleyberkman.com`. The public tag ID is committed with the integration;
it is not a credential. The integration provides a standard opt-out,
disables advertising storage when a visitor changes their preference, masks
the entire chat dock before replay data leaves the browser, and stays disabled
on preview and local hostnames.
Cloudflare supplies aggregate traffic analytics separately at the edge.
Run `npm run setup:main-preview` for the repeatable four-stage setup wizard. It
reuses an existing `gh` login, publishes the feature branch and PR, captures
secrets through hidden prompts, creates the protected GitHub environment, and
leaves deployment disabled unless `ACTIVATE` is typed explicitly. Secret values
are streamed directly to Cloudflare or GitHub and are never written to the
repository, `.env`, command arguments, or shell history. Run the wizard from
Apple Terminal or iTerm, not a Conductor agent terminal: agent credentials
deliberately omit permission to change GitHub Actions workflows. See
[the activation packet](docs/activation/portfolio-main-preview-activation-packet.md)
for secret rotation, iPhone smoke, and rollback requirements.

For initial setup, run the wizard from its prepared feature branch. After that
change has merged, it can instead run from a clean `main` checkout whose local
`HEAD` equals freshly fetched `origin/main`. In this post-merge mode it creates
neither a branch push nor a pull request. It finds the successful push CI run
for that exact SHA, downloads the existing SHA-named `dist/` artifact, and
shows its sorted SHA-256 digest before asking for exact `ACTIVATE`
confirmation. After confirmation, it sets and verifies the deployment gate and
dispatches the protected `deploy-main-preview.yml` workflow with only the
source run ID, SHA, and digest. That workflow verifies and deploys the existing
artifact without rebuilding or overwriting it. If gate readback or dispatch
fails, the wizard verifies a compensating reset to `false`; ordinary later
tested `main` pushes still deploy automatically while the gate remains armed.

`lib/server/portfolio-chat-eval.ts` provides the offline comparison engine. Callers supply named provider implementations and a fixed question set with explicit expected-answer anchors. The engine cannot discover credentials or create a live provider. It accepts uncited conversational language, validates any citations the answer does contain, enforces evidence required by individual reference cases, and reports answer accuracy, average and p95 latency, usage totals, and optional cost estimates from explicit pricing snapshots. `lib/server/portfolio-chat-eval.test.ts` is the deterministic example and never calls an external service. `npm run eval:chat -- --model <id>` runs it against a live provider — real, billable calls, so it is deliberately not in CI.

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:rendered
```

The code lowers scene complexity, caps device pixel ratio, and removes ambient motion before dropping the 3D scene. Final performance proof still requires representative physical devices.

This repository configures `bradleyberkman.com` and `www.bradleyberkman.com`
as password-protected Worker Routes on the permanent main preview. The bounded
single-operator Workers.dev site preview remains tracked in BIV-317, while the
public-domain deployment remains false-gated until its activation packet is
approved. Chat-specific preview
access was retired by BIV-321.
