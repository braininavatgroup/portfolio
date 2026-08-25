# Bradley Berkman portfolio

An experimental spatial portfolio for Bradley Berkman's product, systems, and creative technology work. The main view turns projects into an explorable graph; every project also has a conventional HTML page.

## Run it

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

The development server prints its local URL, normally `http://localhost:3000`.

## Routes

- `/` contains the pointer-responsive figure, transition into the graph, graph controls, node details, and portfolio chat.
- `/index` is the complete HTML project index and works without WebGL.
- `/index/[slug]` contains a project's case study and evidence state.
- Legacy `/work` routes redirect to their canonical `/index` equivalents.

The HTML index and case studies keep their current presentation while the graph uses the new stage model.

## Portfolio model

`lib/portfolio-model.ts` defines projects, reusable entities, relations, projections, validation, and pure lookups. `lib/portfolio-adapter.ts` currently accepts the legacy `ArtifactRecord[]` collection and translates each record into that model. This adapter is a temporary input compatibility boundary, not the permanent content contract.

`lib/spatial-graph.ts` projects the selected model into renderer-owned nodes and positions. The approved `instinct-approach-output/v1` projection is specific to this stage. Its `Instinct`, `Approach`, and `Output` roles do not define a generic graph language or constrain later portfolio models.

`lib/avatar` owns the embodied assistant's validated command contract, semantic target registry, controller, sequence runner, and site-action boundary. `components/avatar` owns the lazy overlay plus the replaceable GLB/procedural renderer. See [Embodied portfolio agent](docs/embodied-portfolio-agent.md) for the architecture, development harness, troubleshooting, and model-swap workflow.

## Evidence policy

The prototype never invents campaign counts, outcomes, artist photos, screenshots, release links, or handoff proof. Missing inputs are labeled `Evidence needed` and occupy replaceable slots. The current CC0 Quaternius game character is a stand-in for Bradley's final 3D model; the procedural figure remains the no-asset fallback.

Inputs still needed for a production version include the real 3D model, roster press photos and verified campaign count, current resume, representative music outcomes, consulting before-and-afters, Dubs and Rit builds, three-maturity interfaces, the personal-tooling map, and one complete spec-to-agent record.

## Portfolio chat launch controls

The model-backed chat is false by default. The single canonical App Router endpoint, `/api/portfolio-chat`, reads server-only Cloudflare bindings and refuses requests before provider construction unless the live gate and provider budget are configured.

During pre-launch, access to the portfolio is a deployment-boundary concern rather than a second authentication flow inside chat. The dedicated site-preview Worker is reachable only at the generated `bradley-portfolio-preview.<account-subdomain>.workers.dev` hostname. Chat still retains the global Durable Object request budget, bounded request bodies, a 15-second provider timeout, and privacy-safe telemetry. Telemetry contains result codes, timing, evidence IDs, answer length, model label, and token usage. It excludes raw questions, answers, Turnstile tokens, IP addresses, provider keys, upstream bodies, and exception messages.

Future public launch controls remain dormant and independent: setting `PORTFOLIO_CHAT_TURNSTILE_REQUIRED=true` requires Turnstile, a Cloudflare route limiter, and a server-only `PORTFOLIO_CHAT_IDENTIFIER_SECRET`. The runtime HMAC-pseudonymizes the trusted Cloudflare connecting IP before using it as a limiter key or OpenAI `safety_identifier`; raw IPs are never forwarded or logged. Leaving the setting false touches none of those capabilities.

The provider is one OpenAI Agents SDK text agent with one model turn and no tools, handoffs, or persistent session. Its instructions define the portfolio-guide task, and every run receives the complete published portfolio evidence plus the bounded transcript from the current browser visit. The agent always answers conversationally: published Bradley facts can carry citations, unknown Bradley details get a natural statement of uncertainty, social chat stays open-ended, and the application owns the one-time third-general-turn nudge. SDK tracing and OpenAI response storage are disabled so this adoption does not broaden the telemetry or retention contract.

`wrangler.preview.jsonc` owns the site-preview Worker's non-secret configuration: model `gpt-5.6-terra` with medium reasoning, a 200-request UTC-day Durable Object budget, its SQLite migration, disabled public controls, and no custom-domain route. `OPENAI_API_KEY` is supplied only as an encrypted Worker secret.

`lib/server/portfolio-chat-eval.ts` provides the offline comparison engine. Callers supply named provider implementations and a fixed question set with explicit expected-answer anchors. The engine cannot discover credentials or create a live provider. It accepts uncited conversational language, validates any citations the answer does contain, enforces evidence required by individual reference cases, and reports answer accuracy, average and p95 latency, usage totals, and optional cost estimates from explicit pricing snapshots. `lib/server/portfolio-chat-eval.test.ts` is the deterministic example and never calls an external service.

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:rendered
```

The code lowers scene complexity, caps device pixel ratio, and removes ambient motion before dropping the 3D scene. Final performance proof still requires representative physical devices.

This repository does not configure or authorize a production/custom-domain release. The dedicated Workers.dev site preview and its bounded activation record are tracked in BIV-317. Chat-specific preview access was retired by BIV-321.
