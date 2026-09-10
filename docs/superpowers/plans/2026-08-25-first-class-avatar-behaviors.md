# First-class avatar behaviors implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 20 supplied avatar clips exact, named behaviors and have the existing OpenAI portfolio agent select a visible behavior sequence for every successful answer.

**Architecture:** One immutable avatar behavior registry owns IDs, exact GLB clip names, labels, semantic guidance, and sequence hold times. The existing `@openai/agents` agent receives a generated catalog in static instructions and returns one to three registry IDs through its Zod structured output. The server converts those IDs to validated avatar effects only after answer validation, while the controller uses a direct state map and fails the isolated avatar renderer instead of substituting another clip.

**Tech Stack:** TypeScript 5.9, React 19, Three.js 0.185, React Three Fiber, Drei, `@openai/agents` 0.17, Zod 4.4, Vitest 4.1, Vinext/Vite.

**Spec:** `docs/superpowers/specs/2026-08-25-first-class-avatar-behaviors-design.md`

## Global constraints

- Ticket identity is `PER-15`; use it in commit subjects.
- Preserve `assets/avatar-sources/bradley-meshy-rigged.glb` and `public/avatars/bradley-meshy-rigged.glb` byte-for-byte equal.
- Render only the exact Meshy model scene. Read missing animation clips from `public/avatars/bradley-motion-library.glb`, but never render that file's scene.
- The behavior catalog contains exactly the 20 Meshy clips in the spec.
- Every behavior ID maps to exactly one exact clip name. No aliases, fallback lists, raw/manual bucket, or keyword router.
- Every successful model output contains one through three behaviors. Ordinary answers select exactly one.
- Every avatar lifecycle state maps directly to one registered behavior.
- Unknown or unavailable configured clips fail validation, build, or the isolated avatar renderer. They never select another clip.
- Reduced motion suppresses agent-selected `play` and `wait` commands.
- Model output cannot contain selectors, URLs, code, bones, transforms, site actions, or arbitrary delays.
- Do not deploy or activate production capability.

---

### Task 1: Authoritative behavior registry and exact asset contract

**Files:**
- Create: `lib/avatar/behaviors.ts`
- Create: `lib/avatar/behaviors.test.ts`
- Modify: `lib/avatar/contracts.ts`
- Modify: `lib/avatar/config.ts`
- Modify: `lib/avatar/config.test.ts`
- Modify: `scripts/avatar/build-bradley-avatar.ts`
- Modify: `scripts/avatar/build-bradley-avatar.test.ts`
- Modify: `assets/avatar-sources/README.md`
- Modify: `package.json`
- Add: `public/avatars/bradley-meshy-rigged.glb`
- Add: `public/avatars/bradley-motion-library.glb`
- Delete: `public/avatars/bradley-ps1.glb`

**Interfaces:**
- Produces: `avatarBehaviors`, `allowedAvatarAnimations`, `AllowedAnimation`, `getAvatarBehavior(id)`, `formatAvatarBehaviorCatalog()`, and `expandAvatarSequence(ids)`.
- Produces: `avatarStateBehaviors: Record<AvatarState, AllowedAnimation>` in `config.ts`.
- `avatarBehaviors` entries have `{ id, clipName, label, guidance, holdMs }`.
- `expandAvatarSequence(ids)` returns `AvatarCommand[]` with a `play` command for each ID and a bounded `wait` between entries.

- [ ] **Step 1: Write the failing registry tests**

Name the break: adding a source clip without a first-class behavior, duplicating a clip, or inserting a guessed fallback could leave the agent and renderer with different vocabularies.

Assert hand-written literals for the complete ordered IDs and exact clip names:

```ts
expect(avatarBehaviors.map(({ id }) => id)).toEqual([
  "agree_gesture",
  "alert",
  "angry_to_tantrum_sit",
  "big_wave_hello",
  "cheer_with_both_hands_1",
  "cheer_with_both_hands",
  "formal_bow",
  "groan_holding_stomach_in_sleep",
  "idle_3",
  "indoor_play",
  "joyful_dance_with_hand_sway",
  "prone_reach_help",
  "running",
  "shrug",
  "sneaky_walk",
  "swim_forward",
  "wake_up_and_look_up",
  "walking",
  "wave_one_hand",
  "swimming_to_edge",
]);

expect(avatarBehaviors.map(({ clipName }) => clipName)).toEqual([
  "Agree_Gesture",
  "Alert",
  "Angry_To_Tantrum_Sit",
  "Big_Wave_Hello",
  "Cheer_with_Both_Hands_1",
  "Cheer_with_Both_Hands",
  "Formal_Bow",
  "Groan_Holding_Stomach_in_Sleep",
  "Idle_3",
  "Indoor_Play",
  "Joyful_Dance_with_Hand_Sway",
  "Prone_Reach_Help",
  "Running",
  "Shrug",
  "Sneaky_Walk",
  "Swim_Forward",
  "Wake_Up_and_Look_Up",
  "Walking",
  "Wave_One_Hand",
  "swimming_to_edge",
]);
```

Assert IDs and clip names are unique, catalog text includes every ID and guidance string, and:

```ts
expect(expandAvatarSequence(["wave_one_hand", "joyful_dance_with_hand_sway"]))
  .toEqual([
    { action: "play", animation: "wave_one_hand" },
    { action: "wait", durationMs: 1_600 },
    { action: "play", animation: "joyful_dance_with_hand_sway" },
  ]);
```

- [ ] **Step 2: Run the registry test and confirm RED**

Run: `npx vitest run lib/avatar/behaviors.test.ts`

Expected: FAIL because `lib/avatar/behaviors.ts` does not exist.

- [ ] **Step 3: Implement the registry and direct state map**

Define all entries from the spec. Use 1,600 milliseconds by default, 1,200 for `walking` and `running`, 2,200 for `big_wave_hello` and `formal_bow`, and 2,800 for `joyful_dance_with_hand_sway`.

Replace `config.animations` and `config.stateFallbacks` with `avatarStateBehaviors` using the exact spec table. Derive `AllowedAnimation` from the registry rather than repeating the old nine semantic aliases.

- [ ] **Step 4: Extend the asset reproduction tests and confirm RED**

Name the break: a build could copy a different visible model or omit one of the 20 registry clips.

Run the build script against controlled temporary output paths. Compare source and rendered model SHA-256 hashes. Inspect both GLBs through the existing parser or `gltf-transform inspect` boundary and assert the union contains the 20 literal clip names. Assert native Meshy clips win over duplicate external clips.

Run: `npx vitest run scripts/avatar/build-bradley-avatar.test.ts lib/avatar/config.test.ts`

Expected: FAIL until the build and configuration consume the new registry.

- [ ] **Step 5: Finish the exact Meshy build contract**

Keep `build:avatar` on `tsx scripts/avatar/build-bradley-avatar.ts`. Copy the exact Meshy source bytes to the public Meshy path and reproduce the external motion library separately. Keep the source and license notes in `assets/avatar-sources/README.md`. Do not transform or recolor the visible Meshy GLB.

- [ ] **Step 6: Run Task 1 proof and commit**

Run:

```bash
npx vitest run lib/avatar/behaviors.test.ts lib/avatar/config.test.ts scripts/avatar/build-bradley-avatar.test.ts
npx tsc --noEmit
```

Expected: PASS and equal Meshy source/public hashes.

Commit only the Task 1 files:

```bash
git add lib/avatar/behaviors.ts lib/avatar/behaviors.test.ts lib/avatar/contracts.ts lib/avatar/config.ts lib/avatar/config.test.ts scripts/avatar/build-bradley-avatar.ts scripts/avatar/build-bradley-avatar.test.ts assets/avatar-sources/README.md package.json public/avatars/bradley-meshy-rigged.glb public/avatars/bradley-motion-library.glb public/avatars/bradley-ps1.glb
git commit -m "PER-15: register exact avatar behavior library"
```

### Task 2: Exact controller behavior and complete developer controls

**Files:**
- Modify: `lib/avatar/state.ts`
- Modify: `lib/avatar/state.test.ts`
- Modify: `lib/avatar/controller.ts`
- Modify: `lib/avatar/controller.test.ts`
- Modify: `lib/avatar/validation.ts`
- Modify: `lib/avatar/validation.test.ts`
- Modify: `components/avatar/AvatarAssetAdapter.tsx`
- Modify: `components/avatar/AvatarAssetAdapter.test.ts`
- Modify: `components/avatar/AvatarDevHarness.tsx`
- Modify: `components/avatar/AvatarOverlay.test.tsx`
- Modify: `components/avatar/ProceduralAvatar.tsx`

**Interfaces:**
- Consumes: Task 1 registry and `avatarStateBehaviors`.
- Produces: `resolveAvatarAnimation(state): AllowedAnimation` as a direct lookup with no availability argument.
- `AvatarController.setAvailableAnimations(available)` marks the avatar failed if any configured registry behavior is absent.
- `getAvailableAnimationIds(clipNames)` returns only IDs whose exact registry clip loaded.

- [ ] **Step 1: Replace fallback expectations with failing direct-map tests**

Name the break: an unavailable preferred clip could silently become `idle_3` or another animation.

Assert every state resolves to the literal behavior in the spec. Assert loading a set that omits a registered clip sets `failed: true` without changing the current behavior. Assert executing an unavailable `play` command also sets `failed: true`.

Run: `npx vitest run lib/avatar/state.test.ts lib/avatar/controller.test.ts`

Expected: FAIL because the current resolver iterates `stateFallbacks` and the controller substitutes `idle`.

- [ ] **Step 2: Implement exact lookup and failure containment**

Delete fallback iteration. Keep the last selected animation in the snapshot when a runtime mismatch occurs, set `failed: true`, and let the avatar-only error UI contain rendering failure. Do not throw into chat.

- [ ] **Step 3: Write failing adapter and harness tests**

Name the breaks: the adapter could load a clip under the wrong semantic alias, mount the processed scene, or hide supplied clips outside the developer controls.

Assert exact registry lookup from a literal clip-name set, native clip precedence, only `model.scene` passed to the rendered `<primitive>`, and 20 development buttons whose accessible labels include readable behavior names.

Run: `npx vitest run components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarOverlay.test.tsx`

Expected: FAIL against the old nine aliases and debug buttons.

- [ ] **Step 4: Implement registry-driven adapter and controls**

Use `getAvatarBehavior(animation).clipName` for mixer lookup. Continue combining native clips before missing external clips. The `<primitive>` object remains `model.scene`; never mount `motionLibrary.scene`. Render every `avatarBehaviors` entry in the development controls.

Update procedural switch cases only as needed to keep its dormant renderer compiling under the new exact IDs. Do not use it as a missing-clip fallback.

- [ ] **Step 5: Update effect validation and reduced-motion behavior test-first**

Name the breaks: the protocol could still accept removed aliases such as `dance`, and reduced motion could run a decorative model-selected clip.

Assert exact registered IDs are accepted, `dance` and unknown IDs are rejected, and `adaptCommandsForReducedMotion` removes `play` and `wait` while preserving direct state and semantic target commands.

Run: `npx vitest run lib/avatar/validation.test.ts lib/avatar/state.test.ts`

Expected: FAIL until validation consumes the registry and reduced-motion adaptation removes `play`.

- [ ] **Step 6: Run Task 2 proof and commit**

Run:

```bash
npx vitest run lib/avatar/*.test.ts components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarOverlay.test.tsx
npx tsc --noEmit
```

Expected: PASS.

Commit:

```bash
git add lib/avatar/state.ts lib/avatar/state.test.ts lib/avatar/controller.ts lib/avatar/controller.test.ts lib/avatar/validation.ts lib/avatar/validation.test.ts components/avatar/AvatarAssetAdapter.tsx components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarDevHarness.tsx components/avatar/AvatarOverlay.test.tsx components/avatar/ProceduralAvatar.tsx
git commit -m "PER-15: make every avatar clip first class"
```

### Task 3: Structured agent behavior selection

**Files:**
- Modify: `lib/server/portfolio-chat-provider.ts`
- Modify: `lib/server/openai-portfolio-provider.ts`
- Modify: `lib/server/openai-portfolio-provider.test.ts`

**Interfaces:**
- Adds: `PortfolioChatProviderInput.onEffects?: (effects: PortfolioResponseEffects) => void`.
- The provider Zod output requires `avatarSequence: z.array(z.enum(allowedAvatarAnimations)).min(1).max(3)`.
- The provider calls `onEffects` with `{ siteActions: [], avatarSequence: expandAvatarSequence(ids), issues: [] }` only after yielding valid rendered answer text.

- [ ] **Step 1: Write failing provider behavior tests**

Name the breaks: the model could return no motion, invent a behavior, choose more than three, or make a valid choice that never reaches the effect channel.

Update completed structured fixtures with `avatarSequence: ["agree_gesture"]`. Add assertions that the request JSON Schema contains `avatarSequence`, the enum contains all 20 literal IDs, `minItems` is 1, `maxItems` is 3, and the generated instructions contain each behavior ID with its semantic guidance.

Add a test whose fake response selects `wave_one_hand` followed by `joyful_dance_with_hand_sway`. Consume the answer and assert `onEffects` receives the expanded literal command sequence. Add invalid fake responses with `[]`, four items, and `dance`; assert each reports `invalid_final_output` and emits no effect.

Run: `npx vitest run lib/server/openai-portfolio-provider.test.ts`

Expected: FAIL because the current schema and provider interface contain no avatar sequence.

- [ ] **Step 2: Implement the generated static catalog and structured output**

Append `formatAvatarBehaviorCatalog()` and the restraint rules from the spec to `portfolioAgentInstructions`. Expand the existing Zod schema instead of adding a tool, second agent, or dynamic instruction callback. Keep `maxTurns: 1`, citation enforcement, topic modes, model settings, and credentials unchanged.

Yield the rendered answer first. When the generator resumes, report the validated expanded effects and usage.

- [ ] **Step 3: Run provider proof and commit**

Run:

```bash
npx vitest run lib/server/openai-portfolio-provider.test.ts
npx tsc --noEmit
```

Expected: PASS.

Commit:

```bash
git add lib/server/portfolio-chat-provider.ts lib/server/openai-portfolio-provider.ts lib/server/openai-portfolio-provider.test.ts
git commit -m "PER-15: let the portfolio agent select motion"
```

### Task 4: Deliver validated effects after answer text

**Files:**
- Modify: `lib/server/portfolio-chat-handler.ts`
- Modify: `lib/server/portfolio-chat-handler.test.ts`
- Modify: `lib/portfolio-chat-client.test.ts`
- Modify: `components/PortfolioChat.test.tsx`
- Modify: `components/PortfolioExperience.test.tsx`

**Interfaces:**
- Consumes: `PortfolioChatProviderInput.onEffects` from Task 3.
- The handler emits `{ type: "effects", effects }` only when answer validation completed with at least one character.
- Event order is evidence, optional mode, one or more answer deltas, effects, done.

- [ ] **Step 1: Write failing handler ordering tests**

Name the breaks: an effect could execute without primary answer text, precede validated text, survive a failed answer, or run after its turn became stale.

Use a real fake provider that yields a valid cited answer and invokes `onEffects` with one literal play command. Assert exact event order. Add invalid-attribution and empty-answer cases and assert no `effects` event. Keep the existing client stale-turn test and update its old alias literals to registered behavior IDs.

Run: `npx vitest run lib/server/portfolio-chat-handler.test.ts lib/portfolio-chat-client.test.ts components/PortfolioChat.test.tsx components/PortfolioExperience.test.tsx`

Expected: FAIL because the handler does not pass or emit provider effects.

- [ ] **Step 2: Buffer and emit validated effects**

Store the latest provider effect payload through `onEffects`. After the validated answer loops finish, emit it only when `answerCharacters > 0`, no abort occurred, and no validation failure was caught. Keep `done` last. Do not let effect callback or serialization errors erase answer text.

- [ ] **Step 3: Run integration proof and commit**

Run:

```bash
npx vitest run lib/server/portfolio-chat-handler.test.ts lib/portfolio-chat-client.test.ts components/PortfolioChat.test.tsx components/PortfolioExperience.test.tsx
npx tsc --noEmit
```

Expected: PASS.

Commit:

```bash
git add lib/server/portfolio-chat-handler.ts lib/server/portfolio-chat-handler.test.ts lib/portfolio-chat-client.test.ts components/PortfolioChat.test.tsx components/PortfolioExperience.test.tsx
git commit -m "PER-15: stream agent-selected avatar effects"
```

### Task 5: Full verification and visible prototype proof

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/built-client-assets.test.mjs`
- Create or update: `.context/verification/per15-*` evidence files, which remain uncommitted
- Update: Linear PER-15 with the delivered behavior list and proof

**Interfaces:**
- Consumes: the complete implementation from Tasks 1 through 4.
- Produces: a reproducible exact model, green repository checks, browser screenshots, and a prototype URL for Bradley's walk.

- [ ] **Step 1: Run focused and affected verification**

Run:

```bash
npx vitest run lib/avatar/*.test.ts components/avatar/AvatarAssetAdapter.test.ts components/avatar/AvatarOverlay.test.tsx lib/server/openai-portfolio-provider.test.ts lib/server/portfolio-chat-handler.test.ts lib/portfolio-chat-client.test.ts components/PortfolioChat.test.tsx components/PortfolioExperience.test.tsx scripts/avatar/build-bradley-avatar.test.ts
npx tsc --noEmit
```

Expected: PASS with no warnings or unhandled errors.

- [ ] **Step 2: Run unconditional repository checks**

Run:

```bash
npm test
npm run lint
npm run build
npm run postbuild
```

Expected: every command exits zero. The production client-asset test rejects `Avatar developer controls` and all other debug-only labels.

- [ ] **Step 3: Verify exact asset provenance**

Run SHA-256 over the source and public Meshy GLBs and assert equality. Inspect both public GLBs and record the 20 native names. Inspect the built client assets for old alias labels and source-only paths.

- [ ] **Step 4: Attach to the existing workspace server and capture browser proof**

Use `http://localhost:3315/?avatarDebug=1`. Do not start another server if the current workspace server is healthy. Capture:

- the exact Meshy avatar facing forward on desktop;
- the complete 20-button developer behavior list;
- a native Meshy behavior;
- mobile placement;
- reduced-motion containment.

Use the `parallel-web-verification` contract and an ephemeral headless browser context. Treat software WebGL as smoke evidence only.

- [ ] **Step 5: Review the complete diff and commit verification-owned changes**

Inspect `git diff origin/main...HEAD`, `git status --short`, and the staged diff. Commit only remaining owned source or test files:

```bash
git add app/globals.css tests/built-client-assets.test.mjs
git commit -m "PER-15: finish avatar behavior prototype"
```

Skip the commit if those files were already committed or have no remaining diff. Do not commit `.context/verification`.

- [ ] **Step 6: Update PER-15 and present the prototype**

Post the exact commit head, verification commands, asset hashes, behavior count, screenshot evidence, and the local prototype URL to Linear PER-15. Do not push, open a pull request, deploy, or activate production until Bradley asks for that separate action.
