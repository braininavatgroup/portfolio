# Layered Avatar Behavior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the portfolio avatar behave like a context-aware stage actor with layered attention, real screen-space travel, collision-aware placement, bounded tone, deterministic page reactions, and freely selected performances.

**Architecture:** `AvatarDirector` owns event priority, ambient selection, and cancellable sequences. `AvatarController` remains the rendering-state store but gains bounded tone and time-bearing stage motion. The GLB continues to play one authored full-body clip while renderer-owned attention, travel, and ambient transforms run independently around it.

**Tech Stack:** React 19, TypeScript, React Three Fiber, Drei, Three.js, Vitest, Testing Library, Vinext, Web Animations API.

**Spec:** `docs/superpowers/specs/2026-08-26-layered-avatar-behavior-design.md`

**Execution status:** Implemented on 2026-08-26 through the feature series from
`b2d239f` to `d5fde5b`. Final proof passed 346 tests, repository lint,
production build, rendered Worker checks, SwiftShader WebGL 2 smoke, and an
interactive desktop/reduced-motion lab matrix. Browser artifacts are under
`.context/verification/avatar-layered-2026-08-26-v3`.

## Global Constraints

- Add no runtime dependency.
- Avatar work never delays, clears, or invalidates answer text.
- Model-controlled values remain closed enums and known semantic IDs. No selectors, URLs, CSS, bones, transforms, code, or arbitrary numbers enter the effect contract.
- One authored full-body clip plays at a time. Layer stage translation, attention yaw, ambient sway, and playback mapping around it.
- Reduced motion removes traversal, decorative waits, selected full-body performances, and ambient sway while preserving stable targets, gaze, and page actions.
- The avatar stays `aria-hidden`; hide/show remains its only required accessible control.
- All production behavior changes follow a witnessed red-green test cycle.

---

### Task 1: Bounded tone and behavior metadata

**Files:**
- Modify: `lib/avatar/behaviors.ts`
- Modify: `lib/avatar/behaviors.test.ts`
- Modify: `lib/avatar/contracts.ts`
- Modify: `lib/avatar/validation.ts`
- Modify: `lib/avatar/validation.test.ts`

**Interfaces:**
- Produces: `AvatarTone`, `AvatarPerformanceIntent`, `defaultAvatarTone`, and behavior metadata `ambientEligible`, `tone`.
- Consumes: existing `AllowedAnimation`, `AvatarCommand`, and exact-key effect validation.

- [ ] **Step 1: Write failing behavior and bounded-value tests**

```ts
it("supplies bounded tone metadata without throttling selected performances", () => {
  expect(avatarBehaviors.filter(({ ambientEligible }) => ambientEligible).map(({ id }) => id))
    .toEqual(["idle_3"]);
  expect(avatarBehaviors[0].tone).toEqual({
    energy: "medium",
    warmth: "warm",
    confidence: "assured",
    mischief: "none",
  });
});

it("accepts only the bounded tone and intent vocabulary", () => {
  const effects = parsePortfolioResponseEffects({
    siteActions: [],
    avatarSequence: [],
    avatarIntent: "expressive",
    avatarTone: {
      energy: "high",
      warmth: "warm",
      confidence: "assured",
      mischief: "playful",
    },
  });
  expect(effects.avatarIntent).toBe("expressive");
  expect(effects.avatarTone?.energy).toBe("high");
});
```

- [ ] **Step 2: Run the focused tests and confirm failures name missing metadata, policy, and parsing**

Run: `npx vitest run lib/avatar/behaviors.test.ts lib/avatar/validation.test.ts`

Expected: FAIL because tone metadata, tone types, and optional effect fields do not exist.

- [ ] **Step 3: Add the closed contracts and policy**

```ts
export const avatarEnergyLevels = ["low", "medium", "high"] as const;
export const avatarWarmthLevels = ["reserved", "warm"] as const;
export const avatarConfidenceLevels = ["uncertain", "neutral", "assured"] as const;
export const avatarMischiefLevels = ["none", "playful"] as const;
export const avatarPerformanceIntents = ["ordinary", "expressive", "requested"] as const;

export type AvatarTone = {
  energy: (typeof avatarEnergyLevels)[number];
  warmth: (typeof avatarWarmthLevels)[number];
  confidence: (typeof avatarConfidenceLevels)[number];
  mischief: (typeof avatarMischiefLevels)[number];
};

export type AvatarPerformanceIntent = (typeof avatarPerformanceIntents)[number];

export const defaultAvatarTone: AvatarTone = {
  energy: "medium",
  warmth: "warm",
  confidence: "neutral",
  mischief: "none",
};
```

- [ ] **Step 4: Run the focused tests and refactor only after green**

Run: `npx vitest run lib/avatar/behaviors.test.ts lib/avatar/validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the bounded behavior contract**

```bash
git add lib/avatar/behaviors.ts lib/avatar/behaviors.test.ts lib/avatar/contracts.ts lib/avatar/validation.ts lib/avatar/validation.test.ts
git commit -m "PER-15: add bounded avatar tone"
```

### Task 2: Collision-aware time-bearing stage motion

**Files:**
- Create: `lib/avatar/stage.ts`
- Create: `lib/avatar/stage.test.ts`
- Modify: `lib/avatar/target-registry.ts`
- Modify: `lib/avatar/target-registry.test.ts`
- Modify: `lib/avatar/controller.ts`
- Modify: `lib/avatar/controller.test.ts`
- Modify: `lib/avatar/sequence-runner.ts`
- Modify: `lib/avatar/sequence-runner.test.ts`

**Interfaces:**
- Produces: `AvatarStageMotion`, `selectStageAnchor(input)`, `stageTravelDuration(distance, energy)`, `AvatarTargetRegistry.resolveAll()`, and async completion for `walkTo`, `enter`, and `exit`.
- Consumes: `AvatarTone`, semantic target bounds, and the sequence runner abort signal.

- [ ] **Step 1: Write failing geometry tests with hand-derived coordinates**

```ts
it("stands beside a wide target instead of covering it", () => {
  expect(selectStageAnchor({
    currentX: 900,
    viewportWidth: 1200,
    avatarWidth: 144,
    gap: 16,
    target: { left: 344, right: 856, top: 600, bottom: 760, width: 512, height: 160, centerX: 600, centerY: 680, inViewport: true },
    obstacles: [],
  })).toBe(944);
});

it("chooses the clear side when another mounted target blocks the nearest side", () => {
  expect(selectStageAnchor({
    currentX: 900,
    viewportWidth: 1200,
    avatarWidth: 144,
    gap: 16,
    target: targetAt(500, 700),
    obstacles: [targetAt(772, 940)],
  })).toBe(412);
});
```

- [ ] **Step 2: Run geometry tests and confirm they fail because the stage module is absent**

Run: `npx vitest run lib/avatar/stage.test.ts`

Expected: FAIL with an unresolved `./stage` import.

- [ ] **Step 3: Implement candidate scoring and travel duration**

```ts
export type AvatarStageMotion = {
  id: number;
  kind: "enter" | "walk" | "exit";
  fromX: number;
  toX: number;
  durationMs: number;
};

export function stageTravelDuration(distance: number, energy: AvatarTone["energy"]) {
  const pixelsPerSecond = energy === "high" ? 760 : energy === "low" ? 360 : 520;
  return Math.round(Math.min(1_800, Math.max(280, distance / pixelsPerSecond * 1_000)));
}
```

Score target-left and target-right anchors by overlap count, then total overlap width, then travel distance. Clamp the chosen center between half the avatar width plus 8 pixels and the viewport width minus the same inset.

- [ ] **Step 4: Write failing registry and controller tests**

The controller test must assert that `walkTo` publishes `fromX`, `toX`, and a nonzero duration, remains pending before the duration, resolves after fake timers advance, returns to idle only if its command still owns the snapshot, and does not apply stale completion after abort.

The registry test must mount two real elements with literal `getBoundingClientRect()` fixtures and assert `resolveAll()` returns both current rectangles.

- [ ] **Step 5: Run registry, controller, and runner tests and confirm the expected failures**

Run: `npx vitest run lib/avatar/target-registry.test.ts lib/avatar/controller.test.ts lib/avatar/sequence-runner.test.ts`

Expected: FAIL because motion state, registry enumeration, and time-bearing execution do not exist.

- [ ] **Step 6: Implement motion state and cancellation**

Add `tone: AvatarTone` and `motion: AvatarStageMotion | null` to `AvatarSnapshot`. Add `{ action: "setTone"; tone: AvatarTone }` to `AvatarCommand`. Change `AvatarController.execute(command, signal?)` to return `void | Promise<void>`. Movement commands publish motion, await an abortable duration, and conditionally settle. `exit` hides only on uncancelled completion. `enter` starts offscreen and ends at the home anchor. `walkTo` uses live `resolveAll()` rectangles and `selectStageAnchor()`.

Pass the runner's existing abort signal into `controller.execute(command, signal)`. Do not add a second movement timer in React.

- [ ] **Step 7: Run all stage tests and refactor only after green**

Run: `npx vitest run lib/avatar/stage.test.ts lib/avatar/target-registry.test.ts lib/avatar/controller.test.ts lib/avatar/sequence-runner.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit stage motion**

```bash
git add lib/avatar/stage.ts lib/avatar/stage.test.ts lib/avatar/target-registry.ts lib/avatar/target-registry.test.ts lib/avatar/controller.ts lib/avatar/controller.test.ts lib/avatar/sequence-runner.ts lib/avatar/sequence-runner.test.ts
git commit -m "PER-15: animate collision-aware avatar travel"
```

### Task 3: Central behavior director and ambient score

**Files:**
- Create: `lib/avatar/director.ts`
- Create: `lib/avatar/director.test.ts`
- Create: `lib/avatar/ambient.ts`
- Create: `lib/avatar/ambient.test.ts`

**Interfaces:**
- Produces: `AvatarDirector`, `AvatarContextEvent`, `AvatarAmbientVariant`, and `chooseAmbientVariant(options)`.
- Consumes: `AvatarController`, `AvatarSequenceRunner`, semantic targets, injected `random`, `setTimer`, and `clearTimer` functions.

- [ ] **Step 1: Write failing priority and ambient tests**

```ts
it("a new turn cancels ambient work and owns thinking", async () => {
  director.onAmbientTick();
  director.onTurnStart();
  expect(controller.getSnapshot().state).toBe("thinking");
  expect(controller.getSnapshot().target).toBe("portfolio:chat");
});

it("never selects the immediately previous ambient variant", () => {
  expect(chooseAmbientVariant({ previous: "still", random: () => 0 })).not.toBe("still");
});
```

- [ ] **Step 2: Run director tests and confirm they fail on missing modules**

Run: `npx vitest run lib/avatar/director.test.ts lib/avatar/ambient.test.ts`

Expected: FAIL with unresolved imports.

- [ ] **Step 3: Implement the director event contract**

```ts
export type AvatarContextEvent =
  | { type: "input_focus" }
  | { type: "input_activity" }
  | { type: "input_blur" }
  | { type: "turn_start" }
  | { type: "evidence" }
  | { type: "first_text" }
  | { type: "turn_complete" }
  | { type: "project_open"; target: ProjectAvatarTargetId }
  | { type: "tab_change"; target: ProjectAvatarTargetId }
  | { type: "project_close" };
```

`AvatarDirector.handle(event)` implements the priority rules from the spec. `perform(effects)` applies tone and runs the complete validated sequence. `startAmbient()` creates one recursive timer; `stopAmbient()` clears it. Ambient variants are weighted but exclude the last accepted variant and execute only when no turn or sequence owns the actor.

- [ ] **Step 4: Run director tests and refactor only after green**

Run: `npx vitest run lib/avatar/director.test.ts lib/avatar/ambient.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the director**

```bash
git add lib/avatar/director.ts lib/avatar/director.test.ts lib/avatar/ambient.ts lib/avatar/ambient.test.ts
git commit -m "PER-15: direct contextual avatar behavior"
```

### Task 4: Renderer-owned travel, attention, and ambient layers

**Files:**
- Create: `lib/avatar/render-motion.ts`
- Create: `lib/avatar/render-motion.test.ts`
- Modify: `components/avatar/AvatarAssetAdapter.tsx`
- Modify: `components/avatar/AvatarAssetAdapter.test.ts`
- Modify: `components/avatar/ProceduralAvatar.tsx`
- Modify: `components/avatar/AvatarOverlay.tsx`
- Modify: `components/avatar/AvatarOverlay.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `avatarPlaybackRate(tone)`, `avatarCrossfadeSeconds(tone)`, `avatarAmbientAmplitude(tone, reducedMotion)`, and `stageMotionKeyframes(motion)`.
- Consumes: snapshot `tone`, `motion`, `facing`, `animation`, reduced-motion preference, and the browser `Element.animate()` boundary.

- [ ] **Step 1: Write failing pure mapping and overlay tests**

```ts
it("maps high energy to faster playback without exceeding the authored range", () => {
  expect(avatarPlaybackRate({ ...defaultAvatarTone, energy: "high" }, 1)).toBe(1.15);
});

it("animates the published stage path once and cancels it when a new path arrives", () => {
  // Render a real AvatarOverlay with a controller, execute two walk motions,
  // and assert the first Animation.cancel() is called before the second animate().
});
```

- [ ] **Step 2: Run focused renderer tests and confirm missing mappings and animation behavior**

Run: `npx vitest run lib/avatar/render-motion.test.ts components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarOverlay.test.tsx`

Expected: FAIL because tone mappings and stage animation do not exist.

- [ ] **Step 3: Implement deterministic renderer mappings**

```ts
export function avatarPlaybackRate(tone: AvatarTone, base: number) {
  const multiplier = tone.energy === "high" ? 1.15 : tone.energy === "low" ? 0.88 : 1;
  return base * multiplier;
}

export function avatarAmbientAmplitude(tone: AvatarTone, reducedMotion: boolean) {
  if (reducedMotion) return 0;
  return tone.mischief === "playful" ? 0.018 : tone.energy === "low" ? 0.004 : 0.009;
}
```

Use a wrapper group to damp yaw toward `facing`, add a bounded breath/sway offset, and keep the authored clip on the inner model. Apply tone-derived playback and fade values to the animation action. Do not alter named bones.

In `AvatarOverlay`, keep one animation handle in a ref. When `snapshot.motion.id` changes, cancel the previous animation and call `element.animate(stageMotionKeyframes(motion), { duration, easing, fill: "both" })`. The stable inline `left` remains `toX` so cancellation cannot snap back.

- [ ] **Step 4: Run renderer tests and refactor only after green**

Run: `npx vitest run lib/avatar/render-motion.test.ts components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarOverlay.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit renderer layers**

```bash
git add lib/avatar/render-motion.ts lib/avatar/render-motion.test.ts components/avatar/AvatarAssetAdapter.tsx components/avatar/AvatarAssetAdapter.test.ts components/avatar/ProceduralAvatar.tsx components/avatar/AvatarOverlay.tsx components/avatar/AvatarOverlay.test.tsx app/globals.css
git commit -m "PER-15: layer avatar attention and stage motion"
```

### Task 5: Contextual chat and portfolio reactions

**Files:**
- Modify: `components/PortfolioChat.tsx`
- Modify: `components/PortfolioChat.test.tsx`
- Modify: `components/PortfolioExperience.tsx`
- Modify: `components/PortfolioExperience.test.tsx`

**Interfaces:**
- Produces: avatar integration callbacks `onInputFocus`, `onInputActivity`, and `onInputBlur`; visitor-driven project open, tab change, and project close events.
- Consumes: `AvatarDirector.handle()`, `AvatarDirector.perform()`, and the existing chat and dossier callbacks.

- [ ] **Step 1: Write failing chat-input behavior tests**

Render the real `PortfolioChat`, focus the input, type one character, and blur it. Assert the integration receives `focus`, one throttled activity notification, and `blur` in order. The break caught is an input that changes while the avatar remains unaware.

- [ ] **Step 2: Run the chat test and confirm the callbacks are absent**

Run: `npx vitest run components/PortfolioChat.test.tsx`

Expected: FAIL because the integration type and input event calls do not exist.

- [ ] **Step 3: Wire input events without changing form behavior**

Call `onInputFocus` from `onFocus`, `onInputBlur` from `onBlur`, and `onInputActivity` only when the changed value differs from the previous value. Keep submission, Turnstile, keyboard behavior, and controlled input state unchanged.

- [ ] **Step 4: Write failing experience tests for visitor navigation**

Use the real `PortfolioExperience` with its existing lightweight canvas boundary. Select a project, switch a dossier tab, and close the dossier. Assert the controller target becomes the project target and later returns to `portfolio:index`. The test catches UI navigation that no longer produces contextual attention.

- [ ] **Step 5: Run experience tests and confirm the director is not wired**

Run: `npx vitest run components/PortfolioExperience.test.tsx`

Expected: FAIL at the new target and contextual-state assertions.

- [ ] **Step 6: Replace direct lifecycle commands with the director**

Construct one `AvatarDirector` beside the existing controller and runner. Delegate chat lifecycle, effects, input events, project selection, tab selection, and project close to it. Start ambient behavior after mount, stop it on cleanup and document hide, and restart it only after visibility returns and the director is idle. Keep site actions on the existing safe executor.

- [ ] **Step 7: Run chat and experience tests and refactor only after green**

Run: `npx vitest run components/PortfolioChat.test.tsx components/PortfolioExperience.test.tsx lib/avatar/director.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit contextual reactions**

```bash
git add components/PortfolioChat.tsx components/PortfolioChat.test.tsx components/PortfolioExperience.tsx components/PortfolioExperience.test.tsx
git commit -m "PER-15: react to visitor attention and navigation"
```

### Task 6: Start semantic performance with first text

**Files:**
- Modify: `lib/server/openai-portfolio-provider.ts`
- Modify: `lib/server/openai-portfolio-provider.test.ts`
- Modify: `lib/server/portfolio-chat-handler.ts`
- Modify: `lib/server/portfolio-chat-handler.test.ts`
- Modify: `lib/portfolio-chat-protocol.ts`
- Modify: `lib/portfolio-chat-client.test.ts`

**Interfaces:**
- Produces: structured `avatarIntent` and `avatarTone`; effect-before-answer provider ordering.
- Consumes: the bounded tone and intent enums, behavior catalog, existing effects event, and the client's first-text buffering guarantee.

- [ ] **Step 1: Write failing structured-output tests**

Extend the literal agent fixture with:

```ts
avatarIntent: "ordinary",
avatarTone: {
  energy: "medium",
  warmth: "warm",
  confidence: "assured",
  mischief: "none",
},
```

Assert the response schema exposes only the enum values, the instructions define `requested` as an explicit visitor request for avatar performance, and `onEffects` observes the validated tone and intent.

- [ ] **Step 2: Write the failing ordering test**

Record provider lifecycle entries in one array and assert `effects` occurs before `answer`. Keep the existing client integration test asserting text commits before avatar work. These two tests together catch both late scoring and avatar work that gets ahead of text rendering.

- [ ] **Step 3: Run provider, handler, and client tests and confirm schema and ordering failures**

Run: `npx vitest run lib/server/openai-portfolio-provider.test.ts lib/server/portfolio-chat-handler.test.ts lib/portfolio-chat-client.test.ts components/PortfolioChat.test.tsx`

Expected: FAIL because the provider output lacks tone and intent and calls effects after yielding text.

- [ ] **Step 4: Extend the provider schema and move effect publication before the answer yield**

Add exact Zod enums sourced from the shared arrays. The provider calls `input.onEffects` with `avatarSequence`, `avatarIntent`, and `avatarTone` immediately before yielding rendered sentences. The handler emits the safe effects event in that order. The client continues buffering effects until first answer text and then calls the director after React commits that text.

- [ ] **Step 5: Run provider, handler, client, and chat tests and refactor only after green**

Run: `npx vitest run lib/server/openai-portfolio-provider.test.ts lib/server/portfolio-chat-handler.test.ts lib/portfolio-chat-client.test.ts components/PortfolioChat.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit semantic timing**

```bash
git add lib/server/openai-portfolio-provider.ts lib/server/openai-portfolio-provider.test.ts lib/server/portfolio-chat-handler.ts lib/server/portfolio-chat-handler.test.ts lib/portfolio-chat-protocol.ts lib/portfolio-chat-client.test.ts
git commit -m "PER-15: score avatar performance with answer delivery"
```

### Task 7: Expand the avatar lab into a behavior instrument panel

**Files:**
- Modify: `components/avatar/AvatarDevHarness.tsx`
- Modify: `components/avatar/AvatarDevHarness.test.tsx`
- Modify: `components/avatar/AvatarOverlay.tsx`
- Modify: `components/PortfolioExperience.tsx`
- Modify: `components/PortfolioExperience.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: tone presets, context-event buttons, both-edge travel, target walk/look/point controls, scripted scenarios, diagnostics, and mounted lab targets.
- Consumes: `AvatarDirector`, controller snapshot, runner, site-action executor, and target registration.

- [ ] **Step 1: Write failing accessible-control tests**

Assert the harness exposes buttons named `tone restrained`, `tone playful`, `walk to portfolio:chat`, `point at hero`, `enter right`, `exit left`, `simulate typing`, `simulate project hosting`, and `multi-behavior performance`. Assert the debug line includes state, animation, target, tone, and motion kind.

- [ ] **Step 2: Run harness and experience tests and confirm missing controls and lab targets**

Run: `npx vitest run components/avatar/AvatarDevHarness.test.tsx components/PortfolioExperience.test.tsx components/avatar/AvatarOverlay.test.tsx`

Expected: FAIL at the new roles and diagnostics.

- [ ] **Step 3: Add controls through public behavior interfaces**

Pass the director into the harness. Tone buttons issue `setTone`. Context buttons call `director.handle`. Scenario buttons call the same director and runner methods used by real chat and navigation. Do not mutate controller private fields or introduce lab-only production methods.

In avatar-lab mode, render fixed `hero` and `portfolio:index` blocks and register them through the existing `registerAvatarTarget` callback. Keep the chat target registration unchanged.

- [ ] **Step 4: Run harness and experience tests and refactor only after green**

Run: `npx vitest run components/avatar/AvatarDevHarness.test.tsx components/PortfolioExperience.test.tsx components/avatar/AvatarOverlay.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the lab**

```bash
git add components/avatar/AvatarDevHarness.tsx components/avatar/AvatarDevHarness.test.tsx components/avatar/AvatarOverlay.tsx components/PortfolioExperience.tsx components/PortfolioExperience.test.tsx app/globals.css
git commit -m "PER-15: expand avatar behavior lab"
```

### Task 8: Documentation and full proof

**Files:**
- Modify: `docs/embodied-portfolio-agent.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-26-layered-avatar-behavior-design.md`

**Interfaces:**
- Consumes: the completed runtime and verified browser behavior.
- Produces: current owning documentation and a final verification record in the plan execution notes.

- [ ] **Step 1: Run affected tests before documentation claims**

Run: `npx vitest run lib/avatar/*.test.ts components/avatar/*.test.tsx components/avatar/*.test.ts components/PortfolioChat.test.tsx components/PortfolioExperience.test.tsx lib/server/openai-portfolio-provider.test.ts lib/server/portfolio-chat-handler.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 2: Update owning documentation**

Document the director, tone vocabulary, unrestricted selected performances, stage placement, contextual events, reduced-motion score, and expanded lab in `docs/embodied-portfolio-agent.md`. Update README development instructions with `/?avatarLab=1`. Remove stale claims that movement jumps to target centers or that the model emits only clip IDs.

- [ ] **Step 3: Run unconditional repository checks**

Run: `npm test -- --run && npm run lint && npm run build && npm run test:rendered`

Expected: all commands exit 0.

- [ ] **Step 4: Attach bounded browser verification to the existing server**

Run the `parallel-web-verification` runner against `http://localhost:3315/?avatarLab=1` and `http://localhost:3315/` with one Chromium process, separate contexts, `--require-webgl`, and run-scoped screenshots. Do not start another server.

Expected: navigation succeeds, WebGL context is present under SwiftShader, no uncaught page errors occur, and report artifacts identify the PER-15 worktree.

- [ ] **Step 5: Perform a manual lab matrix with the headless page**

Exercise restrained and playful tone, chat focus and typing, enter and exit from both edges, walking beside chat and hero targets, project-hosting scenario, repeated large performances, hide/show, and reduced motion. Record console errors, failed requests, final snapshot diagnostics, and screenshots in the browser report directory.

- [ ] **Step 6: Review the implementation against every spec section**

Confirm full-body performance, attention, stage motion, ambient presence, tone, direction priority, answer timing, lab controls, accessibility, and failure behavior each have code plus automated or browser evidence. Record any device-only feel questions as walk items rather than claiming them proven.

- [ ] **Step 7: Commit documentation after fresh verification**

```bash
git add docs/embodied-portfolio-agent.md README.md docs/superpowers/specs/2026-08-26-layered-avatar-behavior-design.md docs/superpowers/plans/2026-08-26-layered-avatar-behavior.md
git commit -m "PER-15: document layered avatar behavior"
```
