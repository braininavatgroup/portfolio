# Embodied portfolio agent implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, lazy, replaceable placeholder avatar that reacts to portfolio chat, targets real content, and can be exercised through a development-only harness.

**Architecture:** `PortfolioExperience` owns one avatar controller, semantic target registry, and site-action executor. Pure `lib/avatar` modules validate and sequence the only commands the application accepts. A lazy transparent React Three Fiber overlay renders either the procedural placeholder or a configured GLB, while `PortfolioChat` reports lifecycle and optional sanitized effects without coupling text rendering to 3D.

**Tech stack:** React 19, TypeScript 5.9, Vinext/Vite, React Three Fiber, Drei, Three.js, Vitest, Testing Library, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-08-25-embodied-portfolio-agent-design.md`

## Global constraints

- Ticket identity is `PER-1`; use it in commit subjects.
- Do not add runtime dependencies. Preserve the selected CC0 source model separately from its production GLB derivative and record its license.
- Keep all model paths, axes, scale, ground offset, clip names, animation fallbacks, playback rate, frame stepping, shading, and texture settings in one asset configuration.
- Model-facing input may contain only allowlisted states, animations, directions, semantic targets, tabs, wait durations, commands, and site actions.
- Never accept JavaScript, selectors, URLs, CSS, bones, transforms, arbitrary numeric controls, or extra object keys.
- Valid semantic targets are `hero`, `portfolio:chat`, `portfolio:index`, and `project:<slug>` derived from `portfolioData`.
- Wait duration range is 0 through 10,000 milliseconds.
- Reduced motion removes travel and decorative waits while preserving text, project selection, scrolling, highlighting, and final stable state.
- Avatar, model, target, animation, WebGL, or effect failures must not clear or delay the text answer.
- The development harness appears only when the build is in development and the URL contains `avatarDebug=1`.
- Keep chat and avatar visibility in one parent-owned state; the compact chat bubble reveals or minimizes both.
- Do not activate or deploy production chat, provider, gate, identity, security, or policy configuration.

---

### Task 1: Safe avatar behavior engine

**Files:**
- Create: `lib/avatar/contracts.ts`
- Create: `lib/avatar/config.ts`
- Create: `lib/avatar/validation.ts`
- Create: `lib/avatar/validation.test.ts`
- Create: `lib/avatar/state.ts`
- Create: `lib/avatar/state.test.ts`
- Create: `lib/avatar/target-registry.ts`
- Create: `lib/avatar/target-registry.test.ts`
- Create: `lib/avatar/sequence-runner.ts`
- Create: `lib/avatar/sequence-runner.test.ts`
- Create: `lib/avatar/site-actions.ts`
- Create: `lib/avatar/site-actions.test.ts`

**Interfaces:**
- Produces: `AvatarState`, `AllowedAnimation`, `AvatarCommand`, `SiteAction`, `PortfolioResponseEffects`, `AvatarTargetId`, `AllowedTab`.
- Produces: `avatarAsset`, `allowedAvatarStates`, `allowedAvatarAnimations`, `allowedAvatarTargets`, `parsePortfolioResponseEffects(value)`, `resolveAvatarAnimation(state, available)`, `adaptCommandsForReducedMotion(commands)`, `AvatarTargetRegistry`, `AvatarSequenceRunner`, `SiteActionExecutor`.
- Consumes: current project slugs from `portfolioData.projects`.

- [ ] **Step 1: Write failing validation tests**

Name the break: a permissive parser could let model output reach an unknown target, animation, action, selector, URL, bone, or transform.

Use literal fixtures that assert:

```ts
expect(parsePortfolioResponseEffects({
  siteActions: [{ type: "openProject", target: "project:dubs" }],
  avatarSequence: [
    { action: "setState", state: "thinking" },
    { action: "wait", durationMs: 25_000 },
  ],
})).toEqual({
  siteActions: [{ type: "openProject", target: "project:dubs" }],
  avatarSequence: [
    { action: "setState", state: "thinking" },
    { action: "wait", durationMs: 10_000 },
  ],
  issues: [],
});

expect(parsePortfolioResponseEffects({
  siteActions: [{ type: "scrollTo", selector: "body", target: "hero" }],
  avatarSequence: [{ action: "play", animation: "eval(location.hash)" }],
}).siteActions).toEqual([]);
```

Also cover an unknown project slug, unknown tab, negative wait clamped to zero, unknown object key, arbitrary URL, and a non-array sequence. Assert that valid siblings survive an invalid sibling only when each array item is independently safe.

- [ ] **Step 2: Run the validation tests and observe the missing-module failure**

Run: `npx vitest run lib/avatar/validation.test.ts`

Expected: FAIL because the avatar contracts and parser do not exist.

- [ ] **Step 3: Implement the closed contracts, data-derived target set, asset configuration, and parser**

Use readonly literal sets and exact-key checks. The configuration must have this shape:

```ts
export type AvatarAssetConfig = {
  kind: "procedural" | "gltf";
  modelUrl: string | null;
  skeletonProfile: "procedural" | "humanoid" | "mixamo";
  scale: number;
  forwardAxis: "z" | "-z";
  groundOffset: number;
  playbackRate: number;
  targetFrameRate: number | null;
  flatShading: boolean;
  nearestTexture: boolean;
  animations: Record<AllowedAnimation, string>;
  stateFallbacks: Record<AvatarState, readonly AllowedAnimation[]>;
};
```

Set the placeholder to `kind: "gltf"` with the Quaternius `Casual_2` production URL, a generic humanoid profile, scale 1, positive Z, centered ground offset, playback rate 1, continuous frame rate, smooth shading, and nearest texture false. Map `idle`, `walk`, `think`, `talk`, `point`, `present`, `celebrate`, and `confused` once. Keep the procedural configuration available as the no-asset fallback.

- [ ] **Step 4: Run validation tests to green**

Run: `npx vitest run lib/avatar/validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing state, target, sequence, reduced-motion, and site-action tests**

Name the breaks:

- a missing clip could flash or stop instead of falling back;
- an unmounted target could leave stale bounds;
- a new turn could allow an old wait to resume;
- reduced motion could remove essential site actions;
- an executor could bypass application-owned callbacks.

Use real fake elements whose `getBoundingClientRect` returns hand-written rectangles. Use fake timers only for the wait boundary. Assert:

```ts
expect(resolveAvatarAnimation("tool_use", new Set(["think", "idle"]))).toBe("think");
expect(resolveAvatarAnimation("success", new Set(["present", "idle"]))).toBe("present");

registry.register("hero", element);
expect(registry.resolve("hero")?.centerX).toBe(160);
registry.unregister("hero", element);
expect(registry.resolve("hero")).toBeUndefined();

expect(adaptCommandsForReducedMotion([
  { action: "enter", from: "left" },
  { action: "walkTo", target: "hero" },
  { action: "setState", state: "talking" },
])).toEqual([
  { action: "lookAt", target: "hero" },
  { action: "setState", state: "talking" },
]);
```

Prove a second `run()` cancels the first pending wait and only the second run's final command executes. Prove `openProject`, `activateTab`, `spotlight`, `clearSpotlight`, and `closeProject` invoke typed callbacks with semantic values.

- [ ] **Step 6: Run the new engine tests and observe missing implementations**

Run: `npx vitest run lib/avatar/state.test.ts lib/avatar/target-registry.test.ts lib/avatar/sequence-runner.test.ts lib/avatar/site-actions.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 7: Implement the minimal engine**

`AvatarTargetRegistry.resolve()` must read live bounds, return `{ left, top, right, bottom, width, height, centerX, centerY, inViewport }`, and never cache a rectangle. `AvatarSequenceRunner` must own one `AbortController`, abort it before each run, and race waits against the abort signal. `SiteActionExecutor` must be callback-only and return `{ ok: boolean; reason?: "missing_target" | "unsupported" }` without throwing into chat.

- [ ] **Step 8: Run the focused engine suite and full unit suite**

Run: `npx vitest run lib/avatar/*.test.ts && npm test`

Expected: all avatar tests and the existing 215 baseline tests pass.

- [ ] **Step 9: Commit Task 1**

```bash
git add lib/avatar/contracts.ts lib/avatar/config.ts lib/avatar/validation.ts lib/avatar/validation.test.ts lib/avatar/state.ts lib/avatar/state.test.ts lib/avatar/target-registry.ts lib/avatar/target-registry.test.ts lib/avatar/sequence-runner.ts lib/avatar/sequence-runner.test.ts lib/avatar/site-actions.ts lib/avatar/site-actions.test.ts
git commit -m "PER-1: add safe avatar behavior engine"
```

### Task 2: Lazy renderer, controller, and development harness

**Files:**
- Create: `lib/avatar/controller.ts`
- Create: `lib/avatar/controller.test.ts`
- Create: `components/avatar/AvatarAssetAdapter.tsx`
- Create: `components/avatar/ProceduralAvatar.tsx`
- Create: `components/avatar/AvatarOverlay.tsx`
- Create: `components/avatar/AvatarOverlay.test.tsx`
- Create: `components/avatar/AvatarDevHarness.tsx`
- Modify: `eslint.config.mjs`

**Interfaces:**
- Consumes: Task 1 contracts, configuration, resolver, registry, and runner.
- Produces: `AvatarController`, `AvatarSnapshot`, `AvatarOverlay`, and `AvatarDevHarness`.
- `AvatarController.subscribe(listener)` returns an unsubscribe function compatible with `useSyncExternalStore`.

- [ ] **Step 1: Write failing controller tests**

Name the breaks: stale controller snapshots can rerender incorrectly, target anchors can escape the viewport, and a malformed stored value can hide the avatar forever.

Assert state changes notify once, horizontal anchors clamp to 80 through `viewportWidth - 80`, look and point direction mirror from the target center, reset returns to the initial snapshot, and model failure sets a quiet failure flag.

- [ ] **Step 2: Run focused tests and observe missing modules**

Run: `npx vitest run lib/avatar/controller.test.ts`

Expected: FAIL because the controller module does not exist.

- [ ] **Step 3: Implement the controller boundary**

The snapshot must expose only:

```ts
export type AvatarSnapshot = {
  state: AvatarState;
  animation: AllowedAnimation;
  currentCommand: AvatarCommand | null;
  target: AvatarTargetId | null;
  anchorX: number;
  facing: "left" | "right";
  pointing: "left" | "right" | null;
  visible: boolean;
  failed: boolean;
};
```

Do not put Three.js objects or DOM nodes in the snapshot.

- [ ] **Step 4: Run controller tests to green**

Run: `npx vitest run lib/avatar/controller.test.ts`

Expected: PASS.

- [ ] **Step 5: Write a failing overlay interaction test**

Name the break: the render layer could become the only information path, intercept the page, lose its hide control, or expose the debug panel in normal production-like rendering.

Mock only the R3F `Canvas` boundary. Render the real overlay and assert an accessible `Hide assistant` button, `pointer-events` separation through class names, the current state in a data attribute, `Show assistant` after hiding, and no developer controls unless both development and `avatarDebug=1` are true. Rerender with `failed: true` and assert the canvas disappears while the show/hide control remains.

- [ ] **Step 6: Run the overlay test and observe the missing component failure**

Run: `npx vitest run components/avatar/AvatarOverlay.test.tsx`

Expected: FAIL because the overlay does not exist.

- [ ] **Step 7: Implement the asset adapter, procedural actor, overlay, and harness**

The procedural actor uses grouped low-poly meshes and authored joint poses for all eight allowed animations. `AvatarAssetAdapter` chooses procedural or GLB from `avatarAsset`; the GLB branch uses Drei loading and animation hooks, applies scale, axis, ground offset, texture settings, playback rate, and 0.2-second fades, and resolves missing clips before playback.

`AvatarOverlay` must lazy-own a transparent `Canvas`, cap DPR at `[1, 1.25]`, use `frameloop="never"` while the document is hidden, contain renderer errors, and expose no accessible avatar content beyond the hide/show control because the text answer carries all meaning. The harness must call the same public controller, runner, and site-action interfaces as chat.

Add `components/avatar/**/*.tsx` to the existing Three.js JSX ESLint override.

- [ ] **Step 8: Run component tests, unit tests, lint, and type-aware build**

Run: `npx vitest run components/avatar/AvatarOverlay.test.tsx lib/avatar/*.test.ts && npm run lint && npm run build`

Expected: all commands exit zero and the build keeps Three.js in a lazy client chunk.

- [ ] **Step 9: Commit Task 2**

```bash
git add lib/avatar/controller.ts lib/avatar/controller.test.ts components/avatar/AvatarAssetAdapter.tsx components/avatar/ProceduralAvatar.tsx components/avatar/AvatarOverlay.tsx components/avatar/AvatarOverlay.test.tsx components/avatar/AvatarDevHarness.tsx eslint.config.mjs
git commit -m "PER-1: render replaceable avatar overlay"
```

### Task 3: Portfolio targets, site actions, and chat lifecycle integration

**Files:**
- Modify: `lib/portfolio-chat-protocol.ts`
- Modify: `lib/portfolio-chat-client.ts`
- Modify: `lib/portfolio-chat-client.test.ts`
- Modify: `components/PortfolioChat.tsx`
- Modify: `components/PortfolioChat.test.tsx`
- Modify: `components/PortfolioDossier.tsx`
- Modify: `components/PortfolioDossier.test.tsx`
- Modify: `components/PortfolioExperience.tsx`
- Modify: `components/PortfolioExperience.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Task 1 parser, registry, runner, executor and Task 2 controller, overlay, and harness.
- Produces: an optional `{ type: "effects"; effects: PortfolioResponseEffects }` `PortfolioChatEvent`.
- `PortfolioChat` receives `avatarIntegration` callbacks for turn start, evidence, first text, safe effects, notice, error, and completion.

- [ ] **Step 1: Write failing stream and chat tests**

Name the breaks: malformed effects could abort answer streaming, stale effects could run after a new turn, or lifecycle changes could delay the text answer.

Add a client fixture with these newline-delimited events:

```ts
{ type: "effects", effects: { avatarSequence: [{ action: "play", animation: "not-allowed" }] } }
{ type: "answer_delta", delta: "Safe answer. [E1]" }
{ type: "done" }
```

Assert the callback receives an empty sanitized effect set, then receives and renders the answer. In `PortfolioChat.test.tsx`, use real lifecycle callbacks and assert submit, evidence, first delta, safe effects, error, and done arrive in order. Start a second question before the first completes and assert the first signal is aborted and its later effects do not run.

- [ ] **Step 2: Run stream and chat tests and observe expected failures**

Run: `npx vitest run lib/portfolio-chat-client.test.ts components/PortfolioChat.test.tsx`

Expected: FAIL because `effects` and avatar integration are not part of the protocol.

- [ ] **Step 3: Implement independent effect sanitization and lifecycle callbacks**

`isPortfolioChatEvent` must accept an effects envelope, call `parsePortfolioResponseEffects` on the nested unknown value, and emit sanitized arrays plus issues. It must not throw for an invalid nested effect. Existing invalid non-effect stream events must retain current error behavior.

`PortfolioChat` must call turn start before the request, tool use on evidence, talking only on the first answer delta, confusion on notice, error on stream or transport failure, and completion in `finally` only for the current non-aborted controller. It must render answer deltas before scheduling avatar work.

- [ ] **Step 4: Run chat tests to green**

Run: `npx vitest run lib/portfolio-chat-client.test.ts components/PortfolioChat.test.tsx`

Expected: PASS.

- [ ] **Step 5: Write failing dossier and experience integration tests**

Name the breaks: semantic targets could point to stale elements, project actions could invent a route, and the avatar could block the existing graph/dossier behavior.

Assert:

- the hero heading registers as `hero`;
- the real chat section registers as `portfolio:chat`;
- the dossier registers `portfolio:index` when no project is open and `project:dubs` when Dubs is selected;
- `openProject project:dubs` selects a current Dubs spatial node;
- `activateTab project:dubs output` selects the output role;
- `closeProject` returns to the index;
- spotlight class moves from the index to the selected project and clears;
- reduced motion passes an adapted avatar sequence but still executes `openProject`;
- hiding persists and leaves the existing chat and navigation operable.

- [ ] **Step 6: Run integration tests and observe expected failures**

Run: `npx vitest run components/PortfolioDossier.test.tsx components/PortfolioExperience.test.tsx`

Expected: FAIL because the components do not register targets or own avatar actions.

- [ ] **Step 7: Implement the composition in `PortfolioExperience`**

Create the controller, registry, sequence runner, and callback-only site executor once. Register the hero and pass registration to chat and dossier. Map project targets through `portfolioNodes.find()` using existing `projectSlug` and role data. Keep current selection helpers as the only mutation path.

Lazy-load `AvatarOverlay` after first client render. Render `AvatarDevHarness` only behind the development and query guard. Add scroll, resize, and visibility listeners with cleanup. Use semantic spotlight classes and a small baseline overlay that stays below the dossier and header. Mobile CSS must keep it clear of the chat input and safe-area inset.

- [ ] **Step 8: Run affected tests and full verification available without a server**

Run: `npx vitest run components/PortfolioDossier.test.tsx components/PortfolioExperience.test.tsx components/PortfolioChat.test.tsx lib/portfolio-chat-client.test.ts lib/avatar/*.test.ts components/avatar/*.test.tsx && npm test && npm run lint && npm run build`

Expected: all commands exit zero.

- [ ] **Step 9: Commit Task 3**

```bash
git add lib/portfolio-chat-protocol.ts lib/portfolio-chat-client.ts lib/portfolio-chat-client.test.ts components/PortfolioChat.tsx components/PortfolioChat.test.tsx components/PortfolioDossier.tsx components/PortfolioDossier.test.tsx components/PortfolioExperience.tsx components/PortfolioExperience.test.tsx app/globals.css
git commit -m "PER-1: connect avatar to portfolio chat"
```

### Task 4: Operator documentation and rendered proof

**Files:**
- Create: `docs/embodied-portfolio-agent.md`
- Modify: `README.md`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: the final commands, targets, config names, debug query, and swap process implemented by Tasks 1 through 3.
- Produces: the maintainer guide and durable production-markup guard.

- [ ] **Step 1: Write a failing rendered-markup guard**

Name the break: a future refactor could ship development harness controls in production HTML.

Add one behavior assertion to the existing rendered HTML test: render `/` under the production build and assert the response does not contain the harness heading or `avatarDebug` control labels. Do not grep source files.

- [ ] **Step 2: Run the rendered test and confirm it catches the unguarded fixture if temporarily enabled**

Run: `npm run test:rendered`

Expected before implementation guard: the focused assertion fails when the harness production guard is inverted. Restore the guard and rerun to PASS. Record both red and green commands in the task report.

- [ ] **Step 3: Write the maintainer guide and update the repository map**

`docs/embodied-portfolio-agent.md` must contain:

- architecture and data flow;
- every allowed command and site action;
- the exact semantic target vocabulary and registration example;
- `/?avatarDebug=1` harness instructions;
- animation aliases and fallback behavior;
- procedural and GLB adapter behavior;
- scale, axis, ground height, frame stepping, flat shading, texture filtering, and playback adjustment points;
- missing model, clip, target, WebGL, cancellation, and storage troubleshooting;
- current limitations and provider boundary;
- the twelve-step Bradley swap checklist from the design;
- concrete optimization commands using `gltf-transform optimize` and a note to preserve the source asset.

Update `README.md` to link this guide and name `lib/avatar` plus `components/avatar` in the architecture section.

- [ ] **Step 4: Start one workspace server and run bounded browser verification**

Use the Conductor-provided port and keep this server for the full matrix:

```bash
npm run dev -- --port "$CONDUCTOR_PORT"
```

In another command, use the `parallel-web-verification` runner against the existing server. Resolve the runner at `/Users/bradleyberkman/.agents/skills/parallel-web-verification/scripts/verify.mjs` and run desktop, mobile query, debug query, and WebGL smoke URLs. Use fresh browser contexts, one browser process, and workspace-scoped artifacts. Do not open the user's Chrome profile.

- [ ] **Step 5: Run the complete verification ladder**

Run:

```bash
npm test
npm run lint
npm run test:rendered
git diff --check origin/main...
```

Inspect the browser report for navigation failures, page errors, failed requests, WebGL vendor/renderer, and screenshots. Treat SwiftShader as smoke proof only.

- [ ] **Step 6: Commit Task 4**

```bash
git add docs/embodied-portfolio-agent.md README.md tests/rendered-html.test.mjs
git commit -m "PER-1: document embodied avatar workflow"
```

- [ ] **Step 7: Reconcile the ticket and hand off physical-device checks**

After review and verification, update PER-1 to `Verification` with a concise comment containing commit SHAs, commands, browser artifact path, remaining limitations, and the exact scan next step. Do not mark the issue Done until Bradley accepts physical-device motion and final feel.
