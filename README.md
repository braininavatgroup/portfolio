# Bradley Berkman portfolio

An experimental spatial portfolio for Bradley Berkman's product, systems, and creative technology work. The main view turns portfolio records and threads into an explorable map with a shared reader; the flat HTML index links into that same reading surface.

This is the source for my own portfolio, published for people interested in how the map, reader, and assistant work. It is actively developed, and a fork needs its own content and deployment configuration. Start with [content/portfolio-content.json](content/portfolio-content.json) for the writing, [lib/portfolio-world.ts](lib/portfolio-world.ts) for the assembled model, or [the avatar documentation](docs/embodied-portfolio-agent.md) for the assistant.

## Run it locally

Requires Git, Node.js 22.13 or newer, npm, and your own OpenAI API key. The development launcher requires a key even if you only want to browse the map. Chat submissions make real provider requests and incur usage charges on that key.

Clone the repository and install its dependencies:

```bash
git clone https://github.com/braininavatgroup/portfolio.git
cd portfolio
bash scripts/bootstrap-worktree.sh
```

Set `OPENAI_API_KEY` in your local process environment using your preferred secret manager, then start the server:

```bash
npm run dev
```

The development server prints its local URL, normally `http://localhost:3000`.
Conductor and manually created Git worktrees use the same idempotent bootstrap
script. It runs `npm ci` when the lockfile or Node version changes, then records
that dependency state inside the worktree. Conductor setup also activates the
versioned `post-checkout` hook, so later `git worktree add` operations bootstrap
their own dependencies automatically. Workspaces can run concurrently because
Wrangler and Miniflare keep their state inside each worktree.

### Maintainer credential setup

`npm run setup:chat` is an optional macOS workflow for this portfolio's operator. It handles development Keychain storage and can upload a production secret to Cloudflare. It is not required when you supply `OPENAI_API_KEY` yourself. The deployment and feedback setup commands later in this README also target this project's infrastructure; adapting a fork requires your own Cloudflare account, bindings, routes, and secrets.

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

A **node** is a dot on the map. Opening one reads one of two authored content types: a **record** (the short piece for one thing in the map reader) or a **thread** (a narrated path through the map; the only long-form type). Authored text lives in `content/portfolio-content.json`; `lib/portfolio-structure.ts` owns IDs, relationships, positions, block order, and media delivery metadata; and `lib/portfolio-world.ts` validates and combines them into the runtime model. Record and Thread bodies interleave prose with structured copy and visual placeholders while the portfolio is being composed. A paragraph may link a phrase to another record or thread (`[phrase](record:<id>)`, `[phrase](thread:<id>)`) or to an outside address (`[phrase](https://…)`), and lines beginning with `- ` render as a bulleted list. Visual blocks support image, video, and gallery formats. Ready images and galleries open at useful scale over the Reader; ready video previews prefer Mux adaptive HLS when a playback ID is present, retain a local MP4 fail-safe, and enter the browser's native fullscreen player when clicked. Closing image media returns focus to the same trigger, while exiting native video fullscreen returns to the embedded loop. Placeholders intentionally render on `main`, and `?review=clean` hides them for a clean reading pass without forking the content. Chat-only facts (audience statement, career timeline, private context) live in `lib/portfolio-private-grounding.ts` and are never rendered in the UI. Grounding labels workbench placeholders as draft context rather than published proof.

`lib/avatar` owns the embodied assistant's validated command contract, semantic target registry, obstacle-aware CSS-pixel stage layout, controller, behavior director, sequence runner, and bounded tone mappings. Safe movement commands include `swimTo` for a semantic target and `swimRoute` with the repository-owned `lap` route. `components/avatar` owns the lazy overlay, Director console, and replaceable GLB/procedural renderer. See [Embodied portfolio agent](docs/embodied-portfolio-agent.md) for architecture, controls, troubleshooting, and the proof boundary.

## Evidence policy

The prototype never invents campaign counts, outcomes, artist photos, screenshots, release links, or handoff proof; a piece that leans on unpublished material says so in its prose or leaves it out. The current CC0 Quaternius game character is a stand-in for Bradley's final 3D model; the procedural figure remains the no-asset fallback.

Inputs still needed for a production version include the real 3D model, roster press photos and verified campaign count, current resume, representative music outcomes, consulting before-and-afters, and Dubs and Writ builds.

## Portfolio chat launch controls

The model-backed chat has one canonical App Router endpoint,
`/api/portfolio-chat`, and no enable/disable gate. In every configured local or
deployed environment, submitting a message reaches the provider. A missing key,
model, request budget, or Durable Object binding is reported as a configuration
error before provider construction rather than silently disabling chat.

The site is public. Chat retains the global Durable Object request budget, bounded request bodies, a 15-second provider timeout, and privacy-safe telemetry. Telemetry contains result codes, timing, evidence IDs, answer length, model label, and token usage. It excludes raw questions, answers, session cookies, IP addresses, provider keys, upstream bodies, and exception messages.

Public chat uses `PORTFOLIO_CHAT_SESSION_REQUIRED=true` for an invisible, signed 30-minute session cookie, a Cloudflare route limiter, and a server-only `PORTFOLIO_CHAT_IDENTIFIER_SECRET`. The Guide opens its session on mount and silently renews expired sessions. The daily request budget is 1,000; the per-IP throttle is unchanged. The runtime HMAC-pseudonymizes the trusted Cloudflare connecting IP before using it as a limiter key or OpenAI `safety_identifier`; raw IPs are never forwarded or logged. The session flag controls only cookie verification; configured rate limiting still applies when it is false.

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

`wrangler.main-preview.jsonc` owns the deployed Worker's non-secret
configuration: model `gpt-5.6-sol` with low reasoning and low verbosity, a
1,000-request UTC-day Durable Object budget, its SQLite migrations, and the
`bradleyberkman.com` plus `www.bradleyberkman.com` Cloudflare Worker Routes in
front of the zone's existing proxied web records. It declares `OPENAI_API_KEY`
as a required encrypted Worker secret. The Worker's name is historical: the
password gate it refers to was removed in PER-16, and the site is open. Its CI
deployment job consumes the
exact `dist/` artifact already proven by CI; that deployment job stays dormant
unless the repository variable
`PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED` is explicitly set to
`true`.

The local Vite Worker supplies the same model, budget, and Durable Object
bindings while `npm run dev` injects the separate Keychain-backed development
key.

The earlier single-operator `bradley-portfolio-preview` Worker and its
`wrangler.preview.jsonc` were removed under PER-12 once this surface superseded
them.

The site is already public with analytics enabled. The
[public launch checklist](docs/activation/portfolio-public-launch-checklist.md)
still tracks the remaining sign-off and post-deployment verification items;
closing them is Bradley's, not a prerequisite this repository can retire.

Microsoft Clarity project `yatoiqtrjm` provides privacy-safe behavioral
analytics only when an eligible public document carries the explicit
`external` analytics context. Missing context, local pages, and opted-out
browsers stay dormant. The public
tag ID is committed with the integration; it is not a credential. The
integration denies advertising storage whenever an explicit preference is
applied, masks the entire chat dock, and supports first-load personal-device
exclusion. Cloudflare supplies aggregate
traffic analytics separately at the edge. See
[`docs/portfolio-insights-operations.md`](docs/portfolio-insights-operations.md)
for personal-device enrollment, opaque job-search links, private outcome
tracking, and the citation-evidence boundary.
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

### Reviewer feedback on the preview

The whole feature is dormant unless `PORTFOLIO_FEEDBACK_ENABLED` is `"true"`.
Today only local development (`vite.config.ts`) sets that; the deployed Worker
sets `"false"`, so `?r=` links are inert in production — no cookie, no redirect,
no "Leave a note" control. Everything below describes the enabled behaviour.

When enabled, design partners leave notes without seeing each other's, and
without a note ever persisting into their own later visits.
Any link with `?r=<code>` works; codes are not predefined. Type one by hand when
you send the site to someone (`https://bradleyberkman.com/?r=Sarah Smith` counts
as `sarah-smith`: the worker lowercases, hyphenates, and trims to 32
characters), or mint the canonical form with `npm run feedback -- --link alice`.
A link sent with its placeholder still in it (`?r=[name]`) lands as the code
`name`; the panel then asks the reviewer for their name and every note carries
it, so the digest still tells people apart. Opening it sets a signed,
90-day `portfolio_reviewer` cookie and redirects to a URL carrying the
normalized reviewer name. Only that named URL shows the "Leave a note"
control in the bottom-left corner; ordinary site URLs remain public-facing
even if the browser retains the cookie. A reviewer can write a note, add an
optional pointer at one element on the page, and Send. Notes go to the
`PORTFOLIO_FEEDBACK` Durable Object through `worker/portfolio-feedback.ts`;
the widget keeps only the current visit's notes in memory so a reviewer can
take one back.

Run `npm run setup:feedback` once from your own terminal: it mints the admin
token, sets it as the required Worker secret `PORTFOLIO_FEEDBACK_ADMIN_TOKEN`
through your Wrangler login, and stores it in your login Keychain. Re-running
rotates it. Then `npm run feedback` prints the digest (add `-- --json` for raw
notes), reading the token from the Keychain or from
`PORTFOLIO_FEEDBACK_ADMIN_TOKEN` if set. The admin route accepts only that
bearer token. Note that where the feature is enabled, nothing else gates the
reviewer surface: the site is public, so any `?r=` link works for whoever holds
it. That is worth deciding on deliberately before flipping
`PORTFOLIO_FEEDBACK_ENABLED` to `"true"` on a public deployment.

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

This repository serves `bradleyberkman.com` and `www.bradleyberkman.com` from
the `bradley-portfolio-main-preview` Worker, configured above. Nothing gates it.
Chat-specific preview access was retired by BIV-321, the bounded single-operator
Workers.dev preview was deleted under PER-12, and the main-preview password gate
was removed under PER-16.

## Media redaction

Run `npm run media:studio` to reopen the local redaction studio. See
[the studio guide](docs/visuals/redaction-studio.md) for saved-work locations,
new media, and the export/review workflow. Originals and selections stay private.

## Contributing and reuse

For bugs, include the browser, device, route, steps to reproduce, and what you expected. Keep private chat transcripts, feedback, credentials, and unpublished personal material out of public issues. For changes, read [AGENTS.md](AGENTS.md) and the relevant component document, then run the checks for the behavior you changed. `npm run typecheck` and `npm run lint` provide static checks; `npm test` runs the repository's test suites. `npm run eval:chat` is a separate provider evaluation and can spend API credit.

The [license](LICENSE) grants MIT terms for source code and documentation subject to its exclusions. Writing, case studies, images, video, avatar models, and other media in `content/`, `public/`, and `assets/` are reserved unless an asset-specific license says otherwise. A fork should supply its own identity and portfolio material. See `public/licenses/` and `assets/avatar-sources/README.md` for third-party asset terms.

## Local writing server

`ops/launchd/com.bradleyberkman.portfolio.writing-server.plist` keeps a dev server for the `~/portfolio-writing` checkout on `127.0.0.1:5170` (BIV-567). `scripts/launchd/install-launchagents.sh` installs it as a plain copy for the current user, unloads any `com.bradleyberkman.portfolio.*` job that `ops/launchd/` no longer declares, and records its declaration for brain-in-a-vat-group's preflight verifier. Nothing runs it automatically; run it by hand, starting with `--dry-run`. Only one writing server can hold port 5170, so when replacing another launchd job that serves this checkout, boot that job out and remove its plist first, then install. `npm run test:launchagents` proves it against a fake `launchctl`.
