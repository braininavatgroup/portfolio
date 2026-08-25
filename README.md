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

`lib/avatar` owns the embodied assistant's validated command contract, semantic target registry, controller, sequence runner, and site-action boundary. `components/avatar` owns the lazy overlay plus the replaceable procedural/GLB renderer. See [Embodied portfolio agent](docs/embodied-portfolio-agent.md) for the architecture, development harness, troubleshooting, and model-swap workflow.

## Evidence policy

The prototype never invents campaign counts, outcomes, artist photos, screenshots, release links, or handoff proof. Missing inputs are labeled `Evidence needed` and occupy replaceable slots. The current procedural figure is a stand-in for Bradley's final 3D model.

Inputs still needed for a production version include the real 3D model, roster press photos and verified campaign count, current resume, representative music outcomes, consulting before-and-afters, Dubs and Rit builds, three-maturity interfaces, the personal-tooling map, and one complete spec-to-agent record.

## Portfolio chat launch controls

The model-backed chat is false by default. The canonical App Router endpoints read server-only Cloudflare bindings and refuse requests before provider construction unless the live gate and the selected launch path are configured.

The signed-preview path supports an HttpOnly preview session, a privacy-safe per-actor preview-attempt limiter, a per-session chat limiter, Turnstile verification, and an OpenAI `safety_identifier` derived from the opaque preview session. The dedicated single-operator path omits that access stack and is reachable only at the generated `bradley-portfolio-preview.<account-subdomain>.workers.dev` hostname. Both paths retain the global Durable Object request budget, bounded request bodies, a 15-second provider timeout, and privacy-safe telemetry. Telemetry contains result codes, timing, evidence IDs, answer length, model label, and token usage. It excludes raw questions, answers, cookies, access codes, Turnstile tokens, IP addresses, provider keys, upstream bodies, and exception messages.

The provider is one OpenAI Agents SDK text agent with one model turn and no tools, handoffs, or persistent session. Its instructions define the portfolio-guide task, and every run receives the complete published portfolio evidence plus the bounded transcript from the current browser visit. SDK tracing and OpenAI response storage are disabled so this adoption does not broaden the telemetry or retention contract.

`wrangler.preview.jsonc` owns the dedicated Worker's non-secret configuration: model `gpt-5.6-terra` with medium reasoning, a 200-request UTC-day Durable Object budget, its SQLite migration, and no custom-domain route. `OPENAI_API_KEY` is supplied only as an encrypted Worker secret. The existing signed-preview path still requires its session, access-code, limiter, and Turnstile bindings before it can be enabled.

`lib/server/portfolio-chat-eval.ts` provides the offline comparison engine. Callers supply named provider implementations and a fixed question set with explicit expected-answer anchors. The engine cannot discover credentials or create a live provider. It reports reference-answer/refusal correctness, citation failures, required evidence, average and p95 latency, usage totals, and optional cost estimates from explicit pricing snapshots. `lib/server/portfolio-chat-eval.test.ts` is the deterministic example and never calls an external service.

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:rendered
```

The code lowers scene complexity, caps device pixel ratio, and removes ambient motion before dropping the 3D scene. Final performance proof still requires representative physical devices.

This repository does not configure or authorize a production/custom-domain release. The dedicated Workers.dev preview and its bounded activation record are tracked in BIV-317.
