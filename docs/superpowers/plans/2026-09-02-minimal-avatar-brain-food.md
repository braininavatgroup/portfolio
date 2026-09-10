# Minimal Avatar and Brain Food Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the general avatar command system and toybox overlay with a fixed chat performance, one explicit leisurely swim lap, and an untimed Brain Food round on the live map.

**Architecture:** A narrow external avatar runtime owns renderer-facing state and fixed performance sequencing. A focused Brain Food hook owns keyboard input and collision while `PortfolioWorld` remains authoritative for live node positions and drawing. Server output can request only `swim_lap`; all clip, timing, position, and route decisions remain in the client.

**Tech Stack:** React 19, TypeScript, React Three Fiber, Three.js, Vitest, Testing Library, 2D canvas map, existing GLB assets

**Spec:** `docs/superpowers/specs/2026-09-02-minimal-avatar-brain-food-design.md`

## Global Constraints

- Normal chat behavior is hidden, idle, then one `agree_gesture` reaction per answer.
- Only an explicit chat request may schedule `swim_lap`, and the lap runs after the answer reaction.
- Brain Food starts from exact `Shift+G`, is untimed, uses WASD or arrow keys, and consumes every map node except Bradley.
- Brain Food and the requested lap use `swim_forward` with leisurely motion.
- Completion uses `cheer_with_both_hands`; Escape restores immediately without celebration.
- Keep avatar rendering failures isolated from chat and the map.
- Add no dependencies, deployment changes, live activation, or production capability.
- Follow `docs/design-conventions.md` and component sheets; new composition CSS uses existing semantic tokens.

---

### Task 1: Narrow the chat effect contract

**Files:**
- Modify: `lib/avatar/contracts.ts`
- Modify: `lib/avatar/validation.ts`
- Modify: `lib/avatar/validation.test.ts`
- Modify: `lib/server/openai-portfolio-provider.ts`
- Modify: `lib/server/openai-portfolio-provider.test.ts`
- Modify: `lib/server/portfolio-chat-handler.test.ts`

**Interfaces:**
- Produces: `type AvatarAction = "swim_lap"`
- Produces: `type PortfolioResponseEffects = { avatarAction: AvatarAction | null; issues: string[] }`
- Produces: `parsePortfolioResponseEffects(value: unknown): PortfolioResponseEffects`
- Removes: general animation IDs, tone, intent, and `AvatarCommand[]` from the network contract

- [ ] **Step 1: Write failing validation tests**

Add cases proving `{ avatarAction: "swim_lap" }` parses, missing action becomes
`null`, unknown actions and extra keys add issues, and old `avatarSequence`,
`avatarTone`, and `avatarIntent` payloads no longer produce commands.

- [ ] **Step 2: Run the focused validation test and verify RED**

Run: `npm test -- lib/avatar/validation.test.ts`

Expected: failures show that `avatarAction` is not part of the current result
and the old command grammar is still accepted.

- [ ] **Step 3: Replace the command parser with the closed action parser**

Use this contract:

```ts
export const avatarActions = ["swim_lap"] as const;
export type AvatarAction = (typeof avatarActions)[number];

export type PortfolioResponseEffects = {
  avatarAction: AvatarAction | null;
  issues: string[];
};
```

`parsePortfolioResponseEffects` accepts only the `avatarAction` key, preserves
`null` or omission as no action, and rejects unknown keys and values without
throwing.

- [ ] **Step 4: Run the focused validation test and verify GREEN**

Run: `npm test -- lib/avatar/validation.test.ts`

- [ ] **Step 5: Write failing provider and handler tests**

Prove ordinary output emits no swim action, explicit swim output emits
`swim_lap`, the static instructions reserve it for explicit requests, and the
handler still emits validated effects only after the first answer delta.

- [ ] **Step 6: Run the provider and handler tests and verify RED**

Run: `npm test -- lib/server/openai-portfolio-provider.test.ts lib/server/portfolio-chat-handler.test.ts`

- [ ] **Step 7: Narrow the provider schema and instructions**

Replace the behavior catalog and sequence fields with:

```ts
avatarAction: z.enum(["none", "swim_lap"])
```

Map `"none"` to `null` at the provider boundary. Instruct the agent to choose
`swim_lap` only when the visitor explicitly asks Bradley to swim; suggested
chat copy uses the same request path.

- [ ] **Step 8: Run the focused server tests and verify GREEN**

Run: `npm test -- lib/server/openai-portfolio-provider.test.ts lib/server/portfolio-chat-handler.test.ts`

- [ ] **Step 9: Commit the narrow protocol**

```bash
git add lib/avatar/contracts.ts lib/avatar/validation.ts lib/avatar/validation.test.ts lib/server/openai-portfolio-provider.ts lib/server/openai-portfolio-provider.test.ts lib/server/portfolio-chat-handler.test.ts
git commit -m "refactor: narrow avatar chat effects"
```

### Task 2: Replace orchestration with a fixed avatar runtime

**Files:**
- Create: `lib/avatar/runtime.ts`
- Create: `lib/avatar/runtime.test.ts`
- Modify: `lib/avatar/config.ts`
- Modify: `lib/avatar/stage.ts`
- Modify: `lib/avatar/stage.test.ts`
- Modify: `components/avatar/AvatarAssetAdapter.tsx`
- Modify: `components/avatar/AvatarAssetAdapter.test.ts`
- Modify: `components/avatar/AvatarStageActor.tsx`
- Modify: `components/avatar/AvatarStageActor.test.tsx`
- Modify: `components/avatar/AvatarOverlay.tsx`
- Modify: `components/avatar/AvatarOverlay.test.tsx`
- Modify: `components/useAvatarStage.ts`
- Modify: `docs/components/avatar/AvatarAssetAdapter.md`
- Modify: `docs/components/avatar/AvatarStageActor.md`
- Modify: `docs/components/avatar/AvatarOverlay.md`
- Modify: `docs/components/useAvatarStage.md`

**Interfaces:**
- Produces: `type AvatarClip = "idle_3" | "agree_gesture" | "swim_forward" | "cheer_with_both_hands"`
- Produces: `class AvatarRuntime` with `show`, `hide`, `react`, `queueSwimLap`, `beginBrainFood`, `setBrainFoodPosition`, `completeBrainFood`, `cancel`, `markFailed`, `subscribe`, and `getSnapshot`
- Produces: `useAvatarStage({ assistantOpen, reducedMotion })` returning the runtime, stage registration, chat dock registration, and renderer mount state
- Consumes: `planSwimLap`, `sampleStagePath`, and `screenPointToOrthographic`

- [ ] **Step 1: Write failing runtime transition tests**

Use fake timers to prove show and hide, one-shot reaction, reaction followed by
queued lap, cancellation on a new turn, Brain Food ownership, completion
celebration, failure isolation, and reduced-motion travel suppression.

- [ ] **Step 2: Run the runtime test and verify RED**

Run: `npm test -- lib/avatar/runtime.test.ts`

Expected: module-not-found or missing-export failures for the new runtime.

- [ ] **Step 3: Implement the minimal external store**

Use a renderer snapshot with only:

```ts
type AvatarSnapshot = {
  phase: "hidden" | "idle" | "reacting" | "swimming" | "brain-food" | "celebrating";
  animation: AvatarClip;
  position: AvatarStagePoint;
  motion: AvatarStageMotion | null;
  facing: AvatarFacing;
  visible: boolean;
  failed: boolean;
};
```

Use one abortable performance chain. `react()` plays `agree_gesture` for its
fixed presentation window. `queueSwimLap()` waits for that reaction, creates
one repository-owned lap, uses a deliberately long fixed duration, then docks
and idles. Brain Food position updates bypass route planning.

- [ ] **Step 4: Run the runtime test and verify GREEN**

Run: `npm test -- lib/avatar/runtime.test.ts`

- [ ] **Step 5: Write failing adapter, actor, overlay, and hook tests**

Prove only the four clips are required, the adapter has no tone or pointing
input, the actor renders fixed or path motion from the narrow snapshot, the
overlay has no Director console branch, chat open and close drive visibility,
and renderer failure only marks the runtime failed.

- [ ] **Step 6: Run the renderer and hook tests and verify RED**

Run: `npm test -- components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarStageActor.test.tsx components/avatar/AvatarOverlay.test.tsx`

- [ ] **Step 7: Rewire the renderer and hook to `AvatarRuntime`**

Keep the current orthographic canvas and stage scale. Remove tone, pointing,
director, registry, debug console, and general command inputs. Make clip
playback rate fixed, with `swim_forward` slower than its current energetic
mapping.

- [ ] **Step 8: Run the runtime and renderer tests and verify GREEN**

Run: `npm test -- lib/avatar/runtime.test.ts components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarStageActor.test.tsx components/avatar/AvatarOverlay.test.tsx`

- [ ] **Step 9: Commit the minimal runtime**

```bash
git add lib/avatar/runtime.ts lib/avatar/runtime.test.ts lib/avatar/config.ts lib/avatar/stage.ts lib/avatar/stage.test.ts components/avatar/AvatarAssetAdapter.tsx components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarStageActor.tsx components/avatar/AvatarStageActor.test.tsx components/avatar/AvatarOverlay.tsx components/avatar/AvatarOverlay.test.tsx components/useAvatarStage.ts docs/components/avatar/AvatarAssetAdapter.md docs/components/avatar/AvatarStageActor.md docs/components/avatar/AvatarOverlay.md docs/components/useAvatarStage.md
git commit -m "refactor: replace avatar orchestration with fixed runtime"
```

### Task 3: Move Brain Food onto the live map

**Files:**
- Create: `lib/avatar/brain-food.ts`
- Create: `lib/avatar/brain-food.test.ts`
- Create: `components/useBrainFoodSession.ts`
- Create: `components/useBrainFoodSession.test.tsx`
- Modify: `components/PortfolioWorld.tsx`
- Modify: `components/PortfolioWorld.test.tsx`
- Modify: `docs/components/PortfolioWorld.md`
- Modify: `components/PortfolioExperience.tsx`
- Modify: `components/PortfolioExperience.test.tsx`
- Modify: `app/globals.css`
- Modify: `lib/portfolio-content-schema.ts`
- Modify: `lib/portfolio-content-schema.test.ts`

**Interfaces:**
- Produces: `type BrainFoodNodePosition = { id: string; x: number; y: number; radius: number }`
- Produces: `integrateBrainFood(body, direction, deltaSeconds, bounds, reducedMotion)` with leisurely speed and bounded movement
- Produces: `collectBrainFoodNodes(nodes, avatarPosition, avatarRadius)` returning newly eaten IDs
- Produces: `useBrainFoodSession({ runtime, enabled })` with `active`, `eatenIds`, `remaining`, `start`, `cancel`, and `syncNodePositions`
- Consumes: live projected node positions from `PortfolioWorld`

- [ ] **Step 1: Write failing pure movement and collision tests**

Prove diagonal input normalizes, top speed stays below the old arcade speed,
coasting decays gradually, reduced motion takes bounded direct steps, Bradley
is excluded, a node is eaten once, and all-node completion is detected.

- [ ] **Step 2: Run the pure Brain Food test and verify RED**

Run: `npm test -- lib/avatar/brain-food.test.ts`

- [ ] **Step 3: Implement the pure Brain Food runtime**

Move only the useful vector, clamping, integration, and collision behavior from
the old toybox runtime. Remove timer, score, pointer velocity, gravity, bounce,
rotation, toss settling, and duplicate collectible layout.

- [ ] **Step 4: Run the pure Brain Food test and verify GREEN**

Run: `npm test -- lib/avatar/brain-food.test.ts`

- [ ] **Step 5: Write failing session and map integration tests**

Prove exact `Shift+G` starts only when enabled, held original movement keys
drive the runtime, Escape cancels, completion waits for celebration, node
positions come from the live map, eaten buttons and connectors disappear, map
selection and dragging pause, and the previous selected/thread state survives
both completion and cancellation.

- [ ] **Step 6: Run the focused component tests and verify RED**

Run: `npm test -- components/useBrainFoodSession.test.tsx components/PortfolioWorld.test.tsx components/PortfolioExperience.test.tsx`

- [ ] **Step 7: Implement the live-map session and rendering mode**

`PortfolioWorld` publishes screen positions from its existing animation frame
without copying layout authority into React. During the game it forces all
non-Bradley nodes visible, omits eaten nodes and affected connectors, disables
buttons and drag handling, and shows a semantic-token status line. The session
updates avatar position imperatively through `AvatarRuntime` and commits React
state only when a node is eaten or the phase changes.

- [ ] **Step 8: Wire chat reaction, optional lap, and Brain Food in the experience**

`onFirstText` calls `runtime.react()`. `onEffects` queues a lap only for
`swim_lap`. `onTurnStart` cancels prior work. The existing chat target callback
becomes a narrow dock registration. Remove toybox lazy imports and overlay
rendering.

- [ ] **Step 9: Run the focused component tests and verify GREEN**

Run: `npm test -- components/useBrainFoodSession.test.tsx components/PortfolioWorld.test.tsx components/PortfolioExperience.test.tsx`

- [ ] **Step 10: Commit map-native Brain Food**

```bash
git add lib/avatar/brain-food.ts lib/avatar/brain-food.test.ts components/useBrainFoodSession.ts components/useBrainFoodSession.test.tsx components/PortfolioWorld.tsx components/PortfolioWorld.test.tsx docs/components/PortfolioWorld.md components/PortfolioExperience.tsx components/PortfolioExperience.test.tsx app/globals.css lib/portfolio-content-schema.ts lib/portfolio-content-schema.test.ts
git commit -m "feat: move Brain Food onto the portfolio map"
```

### Task 4: Remove the old foundation and verify the combined experience

**Files:**
- Delete: `components/avatar-toybox/`
- Delete: `lib/avatar-toybox/`
- Delete: `components/avatar/AvatarDirectorConsole.tsx`
- Delete: `components/avatar/AvatarDirectorConsole.test.tsx`
- Delete: `components/avatar/avatar-director-console.css`
- Delete: `lib/avatar/ambient.ts`
- Delete: `lib/avatar/ambient.test.ts`
- Delete: `lib/avatar/behaviors.ts`
- Delete: `lib/avatar/behaviors.test.ts`
- Delete: `lib/avatar/director.ts`
- Delete: `lib/avatar/director.test.ts`
- Delete: `lib/avatar/render-motion.ts`
- Delete: `lib/avatar/render-motion.test.ts`
- Delete: `lib/avatar/sequence-runner.ts`
- Delete: `lib/avatar/sequence-runner.test.ts`
- Delete: `lib/avatar/stage-services.ts`
- Delete: `lib/avatar/state.ts`
- Delete: `lib/avatar/state.test.ts`
- Delete: `lib/avatar/target-registry.ts`
- Delete: `lib/avatar/target-registry.test.ts`
- Delete or rewrite: `lib/avatar/controller.ts`
- Delete or rewrite: `lib/avatar/controller.test.ts`
- Modify: `app/design/DesignGallery.tsx`
- Modify: `app/design/three-fixtures.tsx`
- Modify: `docs/components/README.md`
- Delete: `docs/components/avatar-toybox/`
- Delete: `docs/components/avatar/AvatarDirectorConsole.md`
- Modify: `README.md`

**Interfaces:**
- Removes every unused public contract named in the design deletion list
- Leaves one avatar canvas during normal chat and no separate game canvas

- [ ] **Step 1: Remove old imports, fixtures, tests, docs, and source files**

Delete only after Tasks 1 through 3 pass, then use `rg` and `knip` to find
stale references. Keep gallery coverage for the shipped four-clip avatar; drop
the Director console and toybox overlay fixtures.

- [ ] **Step 2: Run the full static and unit verification ladder**

Run:

```bash
npm test
npm run lint
npm run build
npx knip
git diff --check origin/main...
```

Expected: every command exits zero, no stale old-avatar imports remain, and
the diff contains no whitespace errors.

- [ ] **Step 3: Run browser verification against one workspace server**

Exercise desktop chat open and close, ordinary answer reaction, suggested and
free-form swim requests, slow lap then dock, Brain Food start, keyboard swim,
several pickups, Escape restoration, full completion, and reduced motion.
Check the console and request log. Capture scoped screenshots for normal chat,
an active round, and restored completion.

- [ ] **Step 4: Inspect the final diff against the spec**

Confirm every retained behavior has a caller and every deletion in the spec is
absent. Check that unrelated portfolio, content, worker authorization, and
deployment code did not change.

- [ ] **Step 5: Commit cleanup and proof fixes**

```bash
git add app components docs lib README.md
git commit -m "refactor: remove legacy avatar and toybox systems"
```
