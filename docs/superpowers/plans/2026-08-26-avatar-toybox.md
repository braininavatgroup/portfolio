# Avatar Toybox Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Ship a hidden, accessible avatar toybox with a deterministic node-collection game and drag-and-throw mode while preserving all normal graph, chat, and avatar behavior.

**Architecture:** A pure CSS-pixel runtime contains all game calculations. One React session hook owns the complete modal/input/RAF cleanup lease, and one lazy portal overlay renders DOM gameplay plus a small cloned-avatar R3F canvas. `PortfolioExperience` supplies canonical data and swaps normal input/rendering only while the toybox is active.

**Tech Stack:** React 19, TypeScript, Vitest/jsdom, React Three Fiber, Drei, Three.js, CSS, Playwright-compatible parallel web verification.

**Spec:** `docs/superpowers/specs/2026-08-26-avatar-toybox-design.md`; ClickUp `86bbmpmmf`.

---

### Task 1: Pure deterministic runtime

**Files:**
- Create: `lib/avatar-toybox/runtime.test.ts`
- Create: `lib/avatar-toybox/runtime.ts`

**Steps:**

1. Write failing table tests for exact activation eligibility, deterministic collectible placement outside HUD/safe bounds, capped delta time, acceleration/damping/speed cap, edge wrapping, reduced-motion stepping, one-shot collisions, active-time expiry, pointer velocity estimation, toss bounce/settling, and resize retention of eaten IDs.
2. Run `npm test -- lib/avatar-toybox/runtime.test.ts` and confirm failures are missing-behavior failures.
3. Implement small exported pure functions and data types. Keep coordinates in CSS pixels and require the caller to pass time, visibility/focus, viewport, hitbox, and pointer samples.
4. Re-run the focused test to green, then run `npm run lint -- --quiet` to expose type/lint defects early.
5. Commit only the runtime and its tests with message `86bbmpmmf: add deterministic avatar toybox runtime`.

### Task 2: Shared keyboard arbitration and layout host

**Files:**
- Create: `lib/dom-keyboard.test.ts`
- Create: `lib/dom-keyboard.ts`
- Modify: `components/KeyboardNavigator.tsx`
- Modify: `components/KeyboardNavigator.test.tsx`
- Modify: `app/layout.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Steps:**

1. Add failing tests for interactive/editable ancestors, contenteditable, ARIA textbox/combobox/searchbox, exact Shift+G modifiers, repeat/composition/default-prevented rejection, and unchanged graph Arrow/Escape handling.
2. Run the focused Vitest files and observe red.
3. Extract the existing navigator target guard into `lib/dom-keyboard.ts`, add the exact activation predicate, and update `KeyboardNavigator` to consume the shared guard without changing its public behavior.
4. Give layout a stable `#app-shell` around skip link/content, add sibling `#avatar-toybox-root`, and make `#main-content` programmatically focusable. Extend rendered HTML proof.
5. Run focused tests and `npm run test:rendered`; commit explicit files as `86bbmpmmf: establish toybox keyboard and portal boundaries`.

### Task 3: Clone-safe avatar adapter

**Files:**
- Modify: `components/avatar/AvatarAssetAdapter.tsx`
- Modify: `components/avatar/AvatarAssetAdapter.test.ts`

**Steps:**

1. Add failing helper/component tests proving two mounts receive distinct skeletal scene roots, retain cache-owned resource identity, and do not dispose shared resources.
2. Run `npm test -- components/avatar/AvatarAssetAdapter.test.ts` and confirm the identity assertion fails against the cached scene reuse.
3. Clone `model.scene` once per mount with `SkeletonUtils.clone`, bind animations and mutations to the clone, and render `<primitive dispose={null}>`.
4. Re-run focused tests and lint; commit as `86bbmpmmf: isolate avatar scene instances`.

### Task 4: Session lease and modal overlay

**Files:**
- Create: `components/avatar-toybox/useAvatarToyboxSession.test.tsx`
- Create: `components/avatar-toybox/useAvatarToyboxSession.ts`
- Create: `components/avatar-toybox/AvatarToyboxOverlay.test.tsx`
- Create: `components/avatar-toybox/AvatarToyboxOverlay.tsx`

**Steps:**

1. Write failing jsdom tests for guarded activation, chooser keys, focus trap, exact prior inert/ARIA restoration, all close sources, idempotent cleanup, blur/visibility input cancellation, pointer capture lifecycle, reduced-motion release, timer pause, result/replay transitions, and live-region cadence.
2. Run the focused files and inspect the expected missing-module/behavior failures.
3. Implement the session reducer/hook around the pure runtime. Keep a single close callback and a single cancel-input callback; use refs for RAF/input resources and React state only for renderable snapshots.
4. Implement the portal overlay with chooser/result controls, persistent Exit button, DOM field/collectibles, HUD, live region, pointer hitbox, and avatar-sized Canvas using the normal avatar camera/DPR/light settings.
5. Add an error boundary outside Suspense/lazy content that routes failures to the same close callback.
6. Run focused tests and lint; commit as `86bbmpmmf: add accessible avatar toybox session`.

### Task 5: Portfolio integration and visual styling

**Files:**
- Modify: `components/PortfolioExperience.test.tsx`
- Modify: `components/PortfolioExperience.tsx`
- Modify: `app/globals.css`
- Modify: `tests/built-client-assets.test.mjs`

**Steps:**

1. Add failing integration tests proving the roster always uses the canonical ordered output nodes, normal `KeyboardNavigator` and `AvatarOverlay` are absent only during an active game, controller/runner updates continue, current controller state returns on exit, chooser does not mount a second avatar, and renderer failure restores normal behavior.
2. Run the focused test and confirm red.
3. Lazy-load the toybox, project output nodes to immutable ID/label/token-kind values, pass live eligibility from assistant mount/controller snapshot, and conditionally compose normal navigation/avatar rendering.
4. Add responsive field, modal, HUD, collectible, hitbox, result, reduced-motion, focus, and forced-exit styling. Do not alter normal graph geometry or normal avatar pointer behavior.
5. Extend the client asset test to record/limit the lazy chunk rather than silently accepting a material bundle increase.
6. Run focused tests, lint, and build; commit as `86bbmpmmf: integrate hidden avatar toybox`.

### Task 6: Combined verification and delivery

**Files:**
- Modify only if verification exposes a defect; add a failing regression test before each durable fix.

**Steps:**

1. Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:rendered` from a clean exact head.
2. Attach one ephemeral browser matrix to the existing Conductor server at `$CONDUCTOR_PORT` using the `parallel-web-verification` scripts. Verify Shift+G eligibility, chat-field rejection, focus trap, graph Arrow behavior before/during/after, both modes, replay/switch/exit, resize cleanup/re-entry, reduced motion, hidden/focus timer pause, one avatar-sized secondary canvas, no extra GLB request, and clean console/network output.
3. Save screenshots and reports under `.context/verification/avatar-toybox/`. Treat SwiftShader as WebGL smoke proof only and record the physical-device feel walk as a handoff item.
4. Request an adversarial code review of the exact diff. Convert every valid durable finding into a failing test, fix it, and repeat focused/full checks.
5. Inspect `git status`, `git diff origin/main...HEAD`, and the staged diff. Commit only explicit ticket files.
6. Push every commit before opening a PR against `main`. The PR must reference ClickUp `86bbmpmmf`, summarize automated proof, and leave activation/deployment untouched.
