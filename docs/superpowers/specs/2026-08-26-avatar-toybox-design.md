# Avatar Toybox Design

**Status:** Approved and adversarially hardened

**Ticket:** Linear `PER-15`

## Intent

Add a hidden, desktop-only play layer for the portfolio avatar. `Shift+G` opens a modal chooser for two short interactions: Brain Food, a 20-second node-collection game, and Toss Bradley, a whole-body drag-and-throw toy. The feature is a disposable client-side session: it must leave graph selection, routes, the shared assistant visibility state, and controller state exactly as it found them.

## Entry contract

- Only exact `Shift+G` opens the chooser. Reject repeat, composition, default-prevented events, extra modifiers, editable or interactive targets, hidden documents, unsupported viewports, and unavailable or failed avatars.
- Version one requires at least `900 x 600` CSS pixels and has no visible launcher.
- The chooser and both modes are modal. `Escape` exits from every state.
- Opening remembers focus, makes `#app-shell` inert and `aria-hidden`, and traps focus in the portal at `#avatar-toybox-root`. Closing restores the shell's exact prior attributes and restores focus, falling back to `#main-content`.
- Normal graph keyboard navigation and the normal avatar overlay are unmounted while a game mode owns input. The avatar controller and sequence runner continue updating invisibly.

## Brain Food

- Arrow keys and WASD move the avatar through a DOM field in CSS-pixel coordinates.
- Collectibles are stable projected copies of the canonical ordered `portfolioNodes.filter(node => node.role === "output")` roster. They never mutate the real graph.
- Normal motion uses acceleration, damping, capped speed, horizontal facing, bounded edges, and `walk`/`idle` poses. Reduced motion uses direct bounded steps.
- Circle collisions score each collectible once. A visible clock counts down 20 seconds of focused, visible active time, and the round ends when all are collected or time expires.
- The result remains visible for five seconds and then returns to the portfolio. Its close control or a click on the playfield returns immediately. There is no replay loop or mode switch after play begins.

## Toss Bradley

- A DOM hitbox owns pointer capture while dragging. Recent pointer samples determine release velocity.
- A small deterministic simulation applies gravity, damping, angular velocity, and bounded bounces to the whole avatar object. `R` resets while the mode is active.
- The first meaningful drag and release completes when the avatar settles upright, then uses the same five-second result and immediate-dismiss behavior as Brain Food.
- Reduced motion still permits dragging but settles immediately on release.

## Architecture

- `lib/avatar-toybox/runtime.ts` is pure and deterministic: eligibility, state transitions, placement, fixed-step movement, collision, timing, pointer velocity, and toss integration. It has no React, DOM, timers, storage, Three.js, or network access.
- `useAvatarToyboxSession` is the single session-lease owner for activation, modal state, listeners, requestAnimationFrame, held input, pointer capture, focus/inert restoration, and one idempotent ordered close path.
- `AvatarToyboxOverlay` lazy-loads into the stable portal root and renders the modal UI, DOM collectibles, HUD, live region, and one avatar-sized transparent R3F canvas.
- `PortfolioExperience` only supplies eligibility, the canonical collectible roster, and controller state, then swaps normal keyboard/avatar rendering according to session status.
- `AvatarAssetAdapter` creates a per-mount `SkeletonUtils.clone` of the cached GLB and a separate animation mixer. Cache-owned resources are rendered with `dispose={null}`; opening the toybox does not trigger another model request.

## Cleanup and failure contract

Every mode change, blur, hidden visibility, lost pointer capture, pointer cancel, close, and unmount clears held input and drag state. Escape, unsupported resize, renderer/model failure, lazy rejection, and unmount all converge on one idempotent close operation: mark closing, cancel animation/time, cancel input and capture, remove listeners, restore shell attributes, commit closed state, then restore focus. A renderer failure closes only the toybox and does not mark the normal avatar failed.

## Accessibility and performance

- The modal has a real heading, concise instructions, a persistent Return to portfolio button, trapped keyboard focus, and a restrained live region. The canvas is decorative.
- The HUD always names active controls. Color is never the only result cue.
- The toybox adds no runtime dependency, physics engine, persistence, analytics, sound, full-screen WebGL root, or model-controlled behavior.
- At play time the page retains the main portfolio canvas plus one avatar-sized canvas, matching the normal renderer count and size class. Animation stops while hidden.

## Proof contract

Pure tests cover eligibility, deterministic placement, bounded motion, collision, timing, velocity estimation, toss physics, reduced motion, and resize. Component tests cover keyboard arbitration, completion timing, focus/inert restoration, cleanup, pointer capture, roster stability, controller continuity, and distinct scene instances. A production-build headless browser run verifies the real portal, keyboard ownership before/during/after, both modes, error and resize cleanup, reduced motion, WebGL topology, resource reuse, and live-region cadence. Toss weight, bounce feel, collision generosity, and keyboard comfort remain a physical-device walk.
