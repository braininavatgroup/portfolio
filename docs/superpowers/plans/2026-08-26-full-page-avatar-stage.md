# Full-page Avatar Stage and Director Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the portfolio avatar a full-viewport, obstacle-aware stage with grounded walking, free x/y swimming, and an operator-friendly Director console that replaces the current developer control wall.

**Architecture:** `AvatarController` owns a stable CSS-pixel foot position, one cancellable `AvatarStageMotion`, and locomotion state. Pure stage functions turn live target and obstacle rectangles into grounded docks or deterministic visibility-graph swim paths. A single fixed orthographic React Three Fiber canvas samples the active path without owning command completion. `AvatarDirectorConsole` composes the same safe controller, runner, director, registry, and site-action interfaces used by the portfolio.

**Tech Stack:** React 19, TypeScript, React Three Fiber, Drei, Three.js, Vitest, Testing Library, Vinext.

**Spec:** `docs/superpowers/specs/2026-08-26-full-page-avatar-stage-design.md`

## Global Constraints

- Add no runtime dependency.
- Keep all stage positions in CSS pixels until the renderer maps them into orthographic world space.
- Keep model-controlled commands closed to known semantic targets and the repository-owned `lap` route. Never accept coordinates, path points, obstacle IDs, selectors, CSS, URLs, or arbitrary route names.
- Keep movement failure isolated. A missing target, unsafe route, missing clip, or renderer error must not delay or invalidate answer text.
- Keep one authored full-body clip active. Grounded movement uses the existing walking or running clip; swimming uses the registered swimming clips.
- Preserve the current controller and sequence-runner ownership rule: a newer run aborts the prior run, and stale completion cannot mutate the new snapshot.
- Keep the full canvas `aria-hidden` and pointer transparent. Only HTML controls own pointer input.
- Keep public hide/show available outside the actor travel area. In lab/debug mode, put visibility control in the Director console.
- Reduced motion removes travel and ambient swimming while preserving stable docking, target selection, gaze, pointing, and page actions.
- Register interface obstacles only from repository-owned code. Obstacle IDs are not part of `PortfolioResponseEffects`.
- Every durable behavior change follows a witnessed red-green cycle.

---

### Task 1: Extend the safe command and reduced-motion contracts

**Files:**
- Modify: `lib/avatar/contracts.ts`
- Modify: `lib/avatar/validation.ts`
- Modify: `lib/avatar/validation.test.ts`
- Modify: `lib/avatar/state.ts`
- Modify: `lib/avatar/state.test.ts`

**Interfaces:**
- Produces: `AvatarRouteId`, `{ action: "swimTo"; target }`, and `{ action: "swimRoute"; route: "lap" }`.
- Consumes: the existing known-target set, exact-key validation, and reduced-motion adapter.

- [ ] **Step 1: Write failing exact-key validation tests**

Add cases that accept only the two semantic forms and reject extra keys, unknown targets, unknown route names, path arrays, and numeric coordinates.

```ts
it("accepts only semantic swimming commands", () => {
  const parsed = parsePortfolioResponseEffects({
    siteActions: [],
    avatarSequence: [
      { action: "swimTo", target: "portfolio:chat" },
      { action: "swimRoute", route: "lap" },
    ],
  });

  expect(parsed.avatarSequence).toEqual([
    { action: "swimTo", target: "portfolio:chat" },
    { action: "swimRoute", route: "lap" },
  ]);
  expect(parsed.issues).toEqual([]);
});

it.each([
  { action: "swimTo", target: "portfolio:chat", x: 12 },
  { action: "swimTo", target: "missing" },
  { action: "swimRoute", route: "custom" },
  { action: "swimRoute", route: "lap", points: [{ x: 1, y: 2 }] },
])("rejects unsafe swimming input %#", (command) => {
  const parsed = parsePortfolioResponseEffects({
    siteActions: [],
    avatarSequence: [command],
  });
  expect(parsed.avatarSequence).toEqual([]);
  expect(parsed.issues).not.toEqual([]);
});
```

- [ ] **Step 2: Write failing reduced-motion tests**

Assert that `swimTo` becomes `lookAt`, `swimRoute` is removed, `walkTo` remains a stable `lookAt`, and target, point, tone, state, and site actions retain their current behavior.

- [ ] **Step 3: Run the focused tests and confirm contract failures**

Run: `npx vitest run lib/avatar/validation.test.ts lib/avatar/state.test.ts`

Expected: FAIL because the new commands and route type do not exist.

- [ ] **Step 4: Add the closed command vocabulary**

```ts
export const avatarRouteIds = ["lap"] as const;
export type AvatarRouteId = (typeof avatarRouteIds)[number];

// Append these variants to the existing AvatarCommand union.
| { action: "swimTo"; target: AvatarTargetId }
| { action: "swimRoute"; route: AvatarRouteId };
```

In `validation.ts`, use `exactKeys` with `action,target` or `action,route`; reuse `isAvatarTarget`; validate route against `avatarRouteIds`. Do not add a permissive string fallback.

- [ ] **Step 5: Adapt reduced-motion behavior**

Map `swimTo` to `lookAt`, omit `swimRoute`, and keep the current treatment of enter, exit, wait, play, and walk.

- [ ] **Step 6: Re-run focused tests and refactor only after green**

Run: `npx vitest run lib/avatar/validation.test.ts lib/avatar/state.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the safe swimming vocabulary**

```bash
git add lib/avatar/contracts.ts lib/avatar/validation.ts lib/avatar/validation.test.ts lib/avatar/state.ts lib/avatar/state.test.ts
git commit -m "PER-15: add semantic avatar swim commands"
```

### Task 2: Build pure two-dimensional stage geometry and routing

**Files:**
- Modify: `lib/avatar/stage.ts`
- Modify: `lib/avatar/stage.test.ts`
- Modify: `lib/avatar/render-motion.ts`
- Modify: `lib/avatar/render-motion.test.ts`

**Interfaces:**
- Produces: `AvatarStagePoint`, `AvatarLocomotion`, path-based `AvatarStageMotion`, grounded floor and dock selection, obstacle inflation, deterministic swim planning, path length, duration, sampling, and orthographic mapping.
- Consumes: live target rectangles and bounded tone energy.

- [ ] **Step 1: Replace x-only fixture expectations with hand-derived 2D geometry tests**

Cover these invariants:

- `groundedFloorY(800, 24)` is `776`.
- A registered expanded console with top `560` raises the floor to `544` when the foot gap is `16`.
- `inflateStageBounds` expands every edge by actor half-width plus gap.
- A walk path changes x but holds one y value.
- Grounded dock selection keeps lowest overlap count, then overlap area, then travel distance.
- Swimming docks appear at the target's left, right, top, and bottom padded edges and remain inside the viewport inset.
- A direct clear swim is two points.
- A blocking rectangle routes through deterministic padded corners.
- A target surrounded by viewport-touching obstacles returns `null`.
- `sampleStagePath` interpolates by distance across multiple unequal segments and returns exact endpoints at progress 0 and 1.
- A lap starts at the actor, travels through open upper and side regions, and ends at a grounded dock.

```ts
it("routes a swim around a blocking rectangle", () => {
  const route = planSwimPath({
    start: { x: 100, y: 700 },
    destinations: [{ x: 900, y: 300 }],
    obstacles: [{ left: 420, top: 200, right: 620, bottom: 650 }],
    viewport: { width: 1_000, height: 800 },
    inset: 24,
  });

  expect(route).toEqual([
    { x: 100, y: 700 },
    { x: 396, y: 674 },
    { x: 644, y: 674 },
    { x: 900, y: 300 },
  ]);
});
```

Use literal expected coordinates based on the chosen padding. If the shortest route uses the top corners instead, update the fixture geometry, not the assertion, so the intended bottom route is unambiguous.

- [ ] **Step 2: Run the stage tests and confirm x-only types fail**

Run: `npx vitest run lib/avatar/stage.test.ts lib/avatar/render-motion.test.ts`

Expected: FAIL because `AvatarStageMotion` has only `fromX` and `toX`, and no 2D planner exists.

- [ ] **Step 3: Define the stable stage types**

```ts
export type AvatarStagePoint = { x: number; y: number };
export type AvatarLocomotion = "grounded" | "swimming";

export type AvatarStageMotion = {
  id: number;
  kind: "enter" | "walk" | "exit" | "swim";
  locomotion: AvatarLocomotion;
  points: readonly AvatarStagePoint[];
  durationMs: number;
};

export type AvatarStageViewport = {
  width: number;
  height: number;
  floorY: number;
};
```

The stable controller position is always `motion.points.at(-1)`. Keep `stageTravelDuration`, but calculate its distance from total path length and use separate grounded and swimming speed tables keyed by tone energy.

- [ ] **Step 4: Implement deterministic geometry helpers**

Add pure functions with no DOM access:

```ts
groundedFloorY(viewportHeight, bottomInset, blockingTop?, blockingGap?): number
inflateStageBounds(bounds, padding): AvatarTargetBounds
selectGroundedDock(input): AvatarStagePoint | null
targetSwimmingDocks(input): AvatarStagePoint[]
planSwimPath(input): AvatarStagePoint[] | null
planSwimLap(input): AvatarStagePoint[] | null
stagePathLength(points): number
sampleStagePath(points, progress): AvatarStagePoint
stageTravelDuration(distance, energy, locomotion): number
screenPointToOrthographic(point, viewport): [number, number, number]
```

Build the visibility graph from start, destination candidates, and obstacle corners. Sort nodes by x then y before edge construction. Reject segments that cross or enter an inflated obstacle. Run Dijkstra with Euclidean edge weight. Resolve equal costs by node order, so tests and browser behavior stay deterministic.

- [ ] **Step 5: Remove DOM keyframes from render motion**

Delete `stageMotionKeyframes`. Keep tone playback, crossfade, and ambient-amplitude helpers. Add only the screen-to-orthographic mapping there if it is renderer-specific; otherwise export it from `stage.ts` and test it in `stage.test.ts`.

- [ ] **Step 6: Run focused geometry tests and refactor only after green**

Run: `npx vitest run lib/avatar/stage.test.ts lib/avatar/render-motion.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the stage planner**

```bash
git add lib/avatar/stage.ts lib/avatar/stage.test.ts lib/avatar/render-motion.ts lib/avatar/render-motion.test.ts
git commit -m "PER-15: plan two-dimensional avatar routes"
```

### Task 3: Add repository-owned interface obstacles to the target registry

**Files:**
- Modify: `lib/avatar/target-registry.ts`
- Modify: `lib/avatar/target-registry.test.ts`

**Interfaces:**
- Produces: `AvatarObstacleId`, obstacle registration, live stage-map resolution, and viewport metrics.
- Consumes: semantic target registrations and `getBoundingClientRect()`.

- [ ] **Step 1: Write failing registry tests**

Test that:

- targets and obstacles use separate namespaces;
- registering an obstacle never makes it a valid semantic target;
- only the exact element can unregister its registration;
- hidden and offscreen rectangles retain bounds but report `inViewport: false`;
- `resolveStageMap()` reads fresh rectangles after resize or scroll fixtures change;
- the expanded Director console supplies the active floor boundary while an unregistered or collapsed console does not.

```ts
it("keeps repository obstacles out of semantic targets", () => {
  const registry = new AvatarTargetRegistry();
  registry.registerObstacle("portfolio:header", elementAt(0, 0, 1_000, 72));

  expect(registry.resolve("portfolio:header" as AvatarTargetId)).toBeUndefined();
  expect(registry.resolveObstacles()).toEqual([
    expect.objectContaining({ obstacle: "portfolio:header" }),
  ]);
});
```

- [ ] **Step 2: Run the registry tests and confirm the obstacle API is absent**

Run: `npx vitest run lib/avatar/target-registry.test.ts`

Expected: FAIL on missing obstacle registration and stage-map resolution.

- [ ] **Step 3: Add a closed repository obstacle type and live map**

```ts
export type AvatarObstacleId =
  | "portfolio:header"
  | "avatar:director-console";

export type AvatarStageMap = {
  viewport: { width: number; height: number };
  targets: Array<{ target: AvatarTargetId; bounds: AvatarTargetBounds }>;
  obstacles: Array<{ obstacle: AvatarObstacleId; bounds: AvatarTargetBounds }>;
};
```

Add `registerObstacle`, `unregisterObstacle`, `resolveObstacles`, and `resolveStageMap`. Keep element storage private. Read `innerWidth` and `innerHeight` at resolution time. The controller will derive the current floor from the stage map, so scroll, resize, mount, and unmount need no stale cache invalidation.

- [ ] **Step 4: Re-run registry tests and refactor only after green**

Run: `npx vitest run lib/avatar/target-registry.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the interface map**

```bash
git add lib/avatar/target-registry.ts lib/avatar/target-registry.test.ts
git commit -m "PER-15: map avatar stage obstacles"
```

### Task 4: Move controller ownership from an x anchor to a 2D foot position

**Files:**
- Modify: `lib/avatar/controller.ts`
- Modify: `lib/avatar/controller.test.ts`
- Modify: `lib/avatar/sequence-runner.test.ts`

**Interfaces:**
- Produces: `position`, `locomotion`, path-based movement, swimming commands, safe cancellation, docking, and `stopMotion()`.
- Consumes: stage geometry, live registry map, available clips, and runner abort signals.

- [ ] **Step 1: Write failing snapshot and grounded movement tests**

Replace `anchorX` assertions with `position`. Stub both viewport dimensions. Assert the initial snapshot sits at the right home dock on the floor, walking keeps one y value, enter and exit are horizontal, target facing uses `position.x`, and a console obstacle raises the computed floor.

- [ ] **Step 2: Write failing swim completion and cancellation tests**

Cover:

- `swimTo` publishes `kind: "swim"`, `locomotion: "swimming"`, and a safe multi-point route;
- `swimRoute:lap` starts only when a closed route exists;
- completed swimming updates the stable position to its final grounded dock, returns `locomotion` to `grounded`, and restores idle;
- an unavailable route leaves the snapshot stable and resolves without throwing;
- abort, a newer state command, hide, `stopMotion()`, reset, and disposal prevent stale completion;
- facing follows the first active segment and settles toward the final target or front at home;
- `stopMotion()` clears controller movement without marking the renderer failed.

```ts
it("completes a safe swim at a grounded dock", async () => {
  vi.useFakeTimers();
  const controller = controllerWithOpenStage();

  const swimming = controller.execute({ action: "swimRoute", route: "lap" });
  expect(controller.getSnapshot()).toMatchObject({
    locomotion: "swimming",
    motion: { kind: "swim", locomotion: "swimming" },
  });

  await vi.runAllTimersAsync();
  await swimming;
  expect(controller.getSnapshot()).toMatchObject({
    locomotion: "grounded",
    state: "idle",
    motion: null,
  });
  expect(controller.getSnapshot().position.y).toBe(776);
});
```

- [ ] **Step 3: Run controller and runner tests and confirm x-only failures**

Run: `npx vitest run lib/avatar/controller.test.ts lib/avatar/sequence-runner.test.ts`

Expected: FAIL because the snapshot, movement creation, and commands are still x-only.

- [ ] **Step 4: Implement one movement constructor and one ownership timer**

Centralize route publication:

```ts
#createMotion(
  kind: AvatarStageMotion["kind"],
  locomotion: AvatarLocomotion,
  points: readonly AvatarStagePoint[],
): AvatarStageMotion
```

Use `#settleMotion` as the only completion timer. The snapshot's stable `position` becomes the final route point immediately, while the renderer samples from the route start. On completion, clear motion and settle locomotion/state. On abort, leave the newer command's snapshot untouched.

For `walkTo`, resolve a fresh stage map and use a grounded dock. For `swimTo`, choose a safe target dock with visibility routing and append a grounded dock if required. For `swimRoute:lap`, call the repository-owned lap planner. If either planner returns `null`, return without updating the snapshot.

- [ ] **Step 5: Give direct state and play commands movement ownership**

Any direct `setState`, `play`, enter, exit, walk, or swim command replaces `motion` as appropriate. `setTone`, look, and point do not cancel stable placement. `setVisible(false)`, `reset`, and `stopMotion()` invalidate the active motion ID so a timer cannot settle later. `stopMotion()` clears the sampled route, returns locomotion to grounded, and keeps the snapshot's already-published stable destination.

- [ ] **Step 6: Re-run controller and runner tests and refactor only after green**

Run: `npx vitest run lib/avatar/controller.test.ts lib/avatar/sequence-runner.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit controller-owned 2D locomotion**

```bash
git add lib/avatar/controller.ts lib/avatar/controller.test.ts lib/avatar/sequence-runner.test.ts
git commit -m "PER-15: move avatar through the full stage"
```

### Task 5: Direct and ambient swimming through the central director

**Files:**
- Modify: `lib/avatar/ambient.ts`
- Modify: `lib/avatar/ambient.test.ts`
- Modify: `lib/avatar/director.ts`
- Modify: `lib/avatar/director.test.ts`

**Interfaces:**
- Produces: safe-route-aware ambient selection, direct swim scenes, swimming-clip route pairing, and cancellation on ownership changes.
- Consumes: controller, runner, registry, reduced-motion state, selected effects, and injected randomness/timers.

- [ ] **Step 1: Write failing ambient arbitration tests**

Assert that `chooseAmbientVariant` can return `swim:lap` when `canSwim` is true, cannot return it when false, and never returns the immediately previous ID. Keep weighted deterministic fixtures by injecting fixed random values.

- [ ] **Step 2: Write failing director tests**

Cover:

- an idle tick can run a lap and return to idle;
- an unsafe lap falls back to stable idle without throwing;
- a new turn cancels ambient swimming before thinking owns the actor;
- direct `perform()` pairs `swim_forward` and `swimming_to_edge` with `swimRoute:lap` only if route planning reports safe;
- other clips keep their current command sequence;
- reduced motion removes direct and ambient swimming;
- `setReducedMotion(true)`, document hide notification, explicit `stop()`, and `dispose()` cancel the current route and prevent timer recreation;
- a direct Director scene cancels ambient ownership before it runs.

- [ ] **Step 3: Run ambient and director tests and confirm failures**

Run: `npx vitest run lib/avatar/ambient.test.ts lib/avatar/director.test.ts`

Expected: FAIL because ambient variants have only still/look and the director does not coordinate swimming.

- [ ] **Step 4: Add safe route capability without exposing geometry**

Add `AvatarController.canExecute({ action: "swimRoute", route: "lap" })` or an equivalent read-only `canSwimLap()` that runs the pure planner against the latest registry map. The director receives only a boolean and safe command. Do not expose route points in the effect contract.

Extend `AvatarAmbientVariant` to a closed union:

```ts
type AvatarAmbientVariant =
  | { id: "still"; command: null }
  | { id: `look:${AvatarTargetId}`; command: { action: "lookAt"; target: AvatarTargetId } }
  | { id: "swim:lap"; command: { action: "swimRoute"; route: "lap" } };
```

Add `AvatarDirector.stop()` as the one public operator cancellation method. It stops ambient scheduling, calls `runner.cancel()`, calls `controller.stopMotion()`, and clears busy ownership without disposing the director.

- [ ] **Step 5: Pair swimming clips with repository movement**

When `perform()` sees either registered swimming animation, append or prepend one `swimRoute:lap` command in the same runner sequence if a safe route exists. Avoid adding a second route if the validated sequence already contains `swimTo` or `swimRoute`. If no route exists, leave the selected clip in place.

- [ ] **Step 6: Re-run director tests and refactor only after green**

Run: `npx vitest run lib/avatar/ambient.test.ts lib/avatar/director.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit director swimming**

```bash
git add lib/avatar/ambient.ts lib/avatar/ambient.test.ts lib/avatar/director.ts lib/avatar/director.test.ts
git commit -m "PER-15: direct grounded and swimming performances"
```

### Task 6: Render one full-viewport orthographic avatar canvas

**Files:**
- Create: `components/avatar/AvatarStageActor.tsx`
- Create: `components/avatar/AvatarStageActor.test.tsx`
- Modify: `components/avatar/AvatarAssetAdapter.tsx`
- Modify: `components/avatar/AvatarAssetAdapter.test.ts`
- Modify: `components/avatar/AvatarOverlay.tsx`
- Modify: `components/avatar/AvatarOverlay.test.tsx`

**Interfaces:**
- Produces: orthographic stage actor, frame-sampled routes, segment facing, full-page failure isolation, and pointer-transparent canvas.
- Consumes: controller snapshot, stage mapping, model adapter, reduced motion, and document visibility.

- [ ] **Step 1: Write failing actor mapping tests**

Mock `useFrame` and `useThree`. Assert:

- `{ x: 0, y: 0 }` maps to the viewport's top-left orthographic corner;
- the actor's foot origin lands on the requested CSS pixel point;
- a half-progress multi-segment path uses distance sampling, not array index interpolation;
- current segment direction updates horizontal facing while front/back pitch remains in the authored swim clip;
- reduced motion renders the stable final point and never starts frame travel;
- a new motion ID restarts progress from the new route only.

- [ ] **Step 2: Write failing overlay contract tests**

Replace Web Animations assertions with these checks:

- `.avatar-overlay` is a fixed full-stage container with no inline `left`;
- one canvas remains mounted across travel;
- `aria-hidden` and `pointer-events: none` stay on the render layer;
- the public toggle is present outside debug mode and absent when the Director console owns visibility;
- renderer failure removes the canvas but leaves public recovery or Director Reset available;
- document hiding sets `frameloop="never"` and asks the director/controller to cancel travel.

- [ ] **Step 3: Run focused component tests and confirm the moving wrapper fails**

Run: `npx vitest run components/avatar/AvatarStageActor.test.tsx components/avatar/AvatarOverlay.test.tsx components/avatar/AvatarAssetAdapter.test.ts`

Expected: FAIL because the overlay moves a 9rem wrapper with Web Animations and no stage actor exists.

- [ ] **Step 4: Build the stage actor**

`AvatarStageActor` owns only visual interpolation. Use `useFrame` elapsed time to compute progress from the active motion's duration, then call `sampleStagePath`. For no motion, use `snapshot.position`. Convert through `screenPointToOrthographic`. Wrap `AvatarAssetAdapter` in a positioned group whose origin is the model's foot point.

Keep the model's existing normalization, scale, ground offset, animation mixer, tone mapping, pointing, gaze, and availability reporting. Add a single stage-scale constant derived from the current approximate 13rem desktop model height and 9rem mobile height; do not re-normalize the GLB per frame.

- [ ] **Step 5: Convert the overlay to one orthographic viewport canvas**

Remove `overlayRef`, `Animation`, and `stageMotionKeyframes`. Render:

```tsx
<Canvas
  aria-hidden="true"
  orthographic
  camera={{ position: [0, 0, 10], zoom: 1 }}
  className="avatar-overlay-canvas"
  frameloop={documentVisible ? "always" : "never"}
  gl={{ alpha: true, antialias: true }}
  style={{ pointerEvents: "none" }}
>
  <AvatarStageActor snapshot={snapshot} reducedMotion={reducedMotion} />
</Canvas>
```

Update the orthographic camera bounds from `useThree().size` so one world unit equals one CSS pixel. The entire overlay remains fixed and inert.

- [ ] **Step 6: Re-run renderer tests and refactor only after green**

Run: `npx vitest run components/avatar/AvatarStageActor.test.tsx components/avatar/AvatarOverlay.test.tsx components/avatar/AvatarAssetAdapter.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the full-page renderer**

```bash
git add components/avatar/AvatarStageActor.tsx components/avatar/AvatarStageActor.test.tsx components/avatar/AvatarAssetAdapter.tsx components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarOverlay.tsx components/avatar/AvatarOverlay.test.tsx
git commit -m "PER-15: render avatar on a full-page stage"
```

### Task 7: Replace the raw lab controls with the Director console

**Files:**
- Create: `components/avatar/AvatarDirectorConsole.tsx`
- Create: `components/avatar/AvatarDirectorConsole.test.tsx`
- Delete: `components/avatar/AvatarDevHarness.tsx`
- Delete: `components/avatar/AvatarDevHarness.test.tsx`
- Modify: `components/avatar/AvatarOverlay.tsx`
- Modify: `components/avatar/AvatarOverlay.test.tsx`

**Interfaces:**
- Produces: status header, Stop/Reset/Hide/collapse controls, Scenes, Target, Movement, and Advanced tabs.
- Consumes: controller, director, runner, registry, site-action executor, visibility callback, and obstacle registration callback.

- [ ] **Step 1: Write failing semantic and action tests**

Test the console as an operator surface, not by CSS implementation details:

- one region named `Avatar Director console`;
- an accessible tablist in order Scenes, Target, Movement, Advanced;
- Scenes selected by default;
- one-click buttons named Greet, Present project, Answer, Celebrate, Dance, Swim lap, and Come home;
- status text includes plain-language state, clip, target, locomotion, and renderer failure;
- Stop calls `director.stop()`, cancels runner ownership, and leaves the actor at its stable destination;
- Reset restores the initial snapshot and visibility;
- Visibility changes call the same shared assistant-state callback as the public chat control;
- collapse leaves a compact status bar and does not cancel movement;
- selecting Target renders a live stage miniature, selects a known region, and exposes Walk, Swim, Look, Point, Present, and Spotlight only when applicable;
- Movement includes grounded enter/exit, swim lap, target swim, and home dock;
- Advanced contains every `allowedAvatarState`, every item in `avatarBehaviors`, every tone preset, all context simulations, page actions, failure simulation, and diagnostics.

```ts
it("keeps the complete raw surface under Advanced", () => {
  renderDirector();
  fireEvent.click(screen.getByRole("tab", { name: "Advanced" }));

  for (const state of allowedAvatarStates) {
    expect(screen.getByRole("button", { name: `State: ${state}` })).toBeTruthy();
  }
  for (const behavior of avatarBehaviors) {
    expect(screen.getByRole("button", { name: behavior.label })).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run console tests and confirm the old harness fails the contract**

Run: `npx vitest run components/avatar/AvatarDirectorConsole.test.tsx components/avatar/AvatarOverlay.test.tsx`

Expected: FAIL because the Director component and tabs do not exist.

- [ ] **Step 3: Implement bounded scene recipes**

Keep scene definitions repository-owned and colocated until a second caller earns extraction. Scenes compose existing commands and site actions:

- Greet: enter if hidden, walk home, wave, idle.
- Present project: walk to selected project, point, spotlight, idle.
- Answer: look at chat, thinking, talking, idle.
- Celebrate: success state, celebration clip, idle.
- Dance: playful tone, dance clip, idle.
- Swim lap: swimming clip plus `swimRoute:lap`, idle.
- Come home: grounded walk to `portfolio:index`, look front, idle.

Do not duplicate controller or director state inside the console. Read current snapshot through `useSyncExternalStore`.

- [ ] **Step 4: Implement the live target miniature**

Read `registry.resolveStageMap()` when Target opens and on window resize/scroll. Render normalized HTML rectangles inside a labeled preview. Buttons select only known semantic targets. Obstacles are visual map regions but never selectable commands.

- [ ] **Step 5: Register only the expanded console as a floor obstacle**

Expose the panel element through a callback from `AvatarOverlay`/`PortfolioExperience`. Register `avatar:director-console` only while expanded; unregister it on collapse or unmount. Closing or collapsing must not call Stop.

- [ ] **Step 6: Re-run console tests and refactor only after green**

Run: `npx vitest run components/avatar/AvatarDirectorConsole.test.tsx components/avatar/AvatarOverlay.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the Director console**

```bash
git add components/avatar/AvatarDirectorConsole.tsx components/avatar/AvatarDirectorConsole.test.tsx components/avatar/AvatarOverlay.tsx components/avatar/AvatarOverlay.test.tsx components/avatar/AvatarDevHarness.tsx components/avatar/AvatarDevHarness.test.tsx
git commit -m "PER-15: replace avatar controls with Director console"
```

### Task 8: Integrate stage obstacles, cancellation, and responsive layout

**Files:**
- Modify: `components/PortfolioExperience.tsx`
- Modify: `components/PortfolioExperience.test.tsx`
- Modify: `components/PortfolioHeader.tsx`
- Create: `components/PortfolioHeader.test.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.test.ts`

**Interfaces:**
- Produces: live header and console obstacles, full-stage CSS, desktop dock, mobile bottom sheet, and lifecycle cancellation.
- Consumes: target registry, avatar lab flag, reduced-motion preference, document visibility, and existing portfolio layout.

- [ ] **Step 1: Write failing integration tests**

Assert that:

- `PortfolioHeader` forwards a repository-owned obstacle ref without changing its accessible navigation;
- `PortfolioExperience` registers and unregisters the header obstacle;
- the Director console appears only under the existing development/debug gates;
- the public compact toggle remains on ordinary portfolio pages;
- changing reduced motion to true cancels active travel before updating the director policy;
- hiding the avatar cancels travel;
- unmount disposes the director and registry registrations;
- lab mode has no old `Avatar developer controls` heading.

- [ ] **Step 2: Run integration tests and confirm missing registrations**

Run: `npx vitest run components/PortfolioExperience.test.tsx components/PortfolioHeader.test.tsx app/page.test.ts`

Expected: FAIL because obstacles and the new console lifecycle are not integrated.

- [ ] **Step 3: Wire repository-owned obstacle refs**

Use the same callback-ref bookkeeping pattern as semantic targets. Register the visible portfolio header as `portfolio:header`. Pass the registry and Director console obstacle callback through `AvatarOverlay`. Do not make obstacle IDs available to chat parsing or provider prompts.

- [ ] **Step 4: Cancel motion at lifecycle boundaries**

When avatar visibility becomes false, reduced motion becomes true, or `document.hidden` becomes true, call the existing runner/director cancellation path and leave the actor at its stable final dock. On unmount, dispose once.

- [ ] **Step 5: Replace moving-box and harness CSS**

Set `.avatar-overlay` to fixed `inset: 0`, `width: 100vw`, `height: 100dvh`, `overflow: hidden`, and `pointer-events: none`. Keep the canvas absolute inset zero.

Add Director console styles:

- desktop: bounded bottom dock, centered, max width, expanded height capped below the header, internal vertical scrolling, no page overflow;
- collapsed: one compact status row;
- mobile: bottom sheet with safe-area padding, four equal tabs, at least 44px touch targets, and no horizontal scrolling;
- target map: fixed aspect ratio, clipped normalized rectangles, strong selected state;
- clear `:focus-visible` rings and status/failure contrast;
- `.avatar-lab` remains `overflow: hidden`, but no ancestor clips the full-page canvas before the viewport;
- the public toggle remains outside the normal home dock and mapped obstacle regions.

- [ ] **Step 6: Re-run integration tests and refactor only after green**

Run: `npx vitest run components/PortfolioExperience.test.tsx components/PortfolioHeader.test.tsx app/page.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit full-stage integration and layout**

```bash
git add components/PortfolioExperience.tsx components/PortfolioExperience.test.tsx components/PortfolioHeader.tsx components/PortfolioHeader.test.tsx app/globals.css app/page.test.ts
git commit -m "PER-15: integrate the full-page avatar stage"
```

### Task 9: Prove the combined avatar, chat, and rendered portfolio

**Files:**
- Modify: `docs/embodied-portfolio-agent.md`
- Modify: `README.md`
- Create: `.context/verification/full-page-avatar-stage-2026-08-26/` artifacts during verification only

**Interfaces:**
- Produces: current operator documentation and combined-head proof.
- Consumes: all prior tasks plus the separately committed conversational paragraph fix.

- [ ] **Step 1: Update owning documentation**

Replace x-anchor, moving overlay, and raw harness guidance with:

- CSS-pixel foot position and path model;
- grounded floor and swim routing rules;
- semantic targets versus repository obstacles;
- safe `swimTo` and `swimRoute:lap` command examples;
- Director console tab and scene guide;
- reduced-motion and failure behavior;
- lab URL `/?avatarLab=1`.

Do not add a correction appendix. Change the stale source text directly.

- [ ] **Step 2: Run the permanent focused matrix**

Run:

```bash
npx vitest run lib/avatar/stage.test.ts lib/avatar/render-motion.test.ts lib/avatar/target-registry.test.ts lib/avatar/validation.test.ts lib/avatar/state.test.ts lib/avatar/controller.test.ts lib/avatar/sequence-runner.test.ts lib/avatar/ambient.test.ts lib/avatar/director.test.ts components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarStageActor.test.tsx components/avatar/AvatarOverlay.test.tsx components/avatar/AvatarDirectorConsole.test.tsx components/PortfolioExperience.test.tsx components/PortfolioHeader.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the conversational answer regression independently**

Run:

```bash
npx vitest run lib/server/portfolio-chat-handler.test.ts
```

Expected: PASS, including a conversational uncited paragraph before a later cited portfolio fact.

- [ ] **Step 4: Run repository checks**

Run:

```bash
npm test
npm run lint
npm run build
npm run test:rendered-worker
```

Expected: all commands exit 0. Record exact test counts and build artifact identity.

- [ ] **Step 5: Attach browser verification to the existing workspace server**

Use the repository's `parallel-web-verification` capability. Keep the existing server on port 3315; do not start a server per assertion. Use ephemeral browser contexts and store screenshots, console logs, and the report under `.context/verification/full-page-avatar-stage-2026-08-26/`.

Verify at `http://localhost:3315/?avatarLab=1`:

1. Desktop, expanded Director console: Greet, grounded walk, Present project, Swim lap, Come home, collapse, expand, Stop, Reset, Hide, Show.
2. Desktop target map: choose hero, chat, index, and a mounted project; exercise Walk, Swim, Look, Point, Present, and Spotlight.
3. Desktop free swim: confirm the actor routes around header, targets, and expanded console without self-clipping or crossing registered rectangles.
4. Mobile viewport: open each tab, confirm bottom-sheet fit, 44px controls, no horizontal overflow, and no actor clipping before the viewport edge.
5. Mobile reduced motion: travel commands do not animate, target/gaze/point/page actions still work, and ambient swimming does not start.
6. Lifecycle: start swimming, then begin a turn, hide the avatar, enable reduced motion, and hide the document in separate scenarios; each cancels travel without stale completion.
7. Failure isolation: simulate renderer failure, confirm portfolio navigation and chat remain operable, and Reset remains available.
8. Chat: ask `Tell me about my portfolio` and confirm a complete answer with no temporary-unavailable response.

For every scenario, assert no uncaught page error, console error, failed request, or horizontal overflow.

- [ ] **Step 6: Inspect browser artifacts and route only physical feel to the walk**

Open representative desktop, swim, mobile, and reduced-motion screenshots. Confirm actor size, foot placement, console readability, and safe route geometry. Record motion feel, animation blending, and device GPU behavior as human walk items rather than automated blockers.

- [ ] **Step 7: Review the branch diff against the approved spec**

Run:

```bash
git diff --check origin/main...
git diff --stat origin/main...
git status --short
```

Confirm no provider prompt, evidence model, site-action authorization, deployment control, production capability, or unrelated portfolio content changed.

- [ ] **Step 8: Commit documentation and proof references**

```bash
git add docs/embodied-portfolio-agent.md README.md
git commit -m "PER-15: document the full-page avatar stage"
```

Do not commit `.context` browser artifacts.
