# Embodied portfolio agent design

**Ticket:** PER-1

## Goal

Add a small embodied assistant to the portfolio that can react to chat activity and direct attention toward registered content without letting model output access JavaScript, selectors, URLs, CSS, or Three.js internals.

## Repository fit

The site is a Vinext React 19 application deployed through Cloudflare. It already uses React Three Fiber, Drei, Three.js, Vitest, Testing Library, a lazy full-screen portfolio canvas, a grounded streaming chat, a movable project dossier, a reduced-motion hook, and WebGL fallback handling. `PortfolioExperience` is the correct composition owner because it already coordinates the canvas, chat, dossier, selection, motion preference, and route state.

The avatar will be a second, small transparent canvas rather than a child of the existing world scene. This keeps its screen position deterministic while the main perspective camera moves between the body and graph. The additional canvas is lazy-loaded, pauses while the page is hidden, and uses the Three.js packages already in the client bundle.

## Product decisions

- The first production actor is Quaternius's CC0 `Casual_2` low-poly game character, converted from source glTF to a 1.52 MB GLB with one humanoid skin and 24 clips. The procedural actor remains the no-network rollback.
- One asset configuration contains the renderer kind, model URL, scale, forward axis, ground offset, animation map, animation fallbacks, playback rate, flat-shading flag, texture filtering, and target frame rate. No component owns an animation name or orientation correction.
- The adapter supports the procedural rollback, the current temporary GLB, and a future Bradley GLB. Every asset uses the same controller snapshot and animation vocabulary, so replacing the model does not change chat, target, or sequence code.
- Text remains the primary response. Chat lifecycle events can drive safe default avatar states. An optional `effects` stream event carries validated site actions and avatar commands. Invalid effects collapse to an empty effect set and never invalidate an answer delta.
- The live provider will not be changed to emit free-form structured actions in this phase. The client and stream protocol accept the safe contract, tests and the development harness exercise it, and normal chat drives thinking, talking, error, and idle states now. This keeps structured control data separate from conversational answer output.
- The development harness is available only in development and only when `avatarDebug=1` is present. Production retains only the small hide/show control.

## Architecture

### Safe contracts

`lib/avatar/contracts.ts` defines the state, animation, target, tab, command, action, and response-effect types. `lib/avatar/validation.ts` parses unknown data against explicit sets derived from current portfolio data. It rejects unknown keys, actions, targets, tabs, and animations. Waits are clamped to 0 through 10,000 milliseconds. It never accepts a URL, selector, CSS value, code string, bone, transform, or arbitrary number.

Registered target IDs are:

- `hero`
- `portfolio:chat`
- `portfolio:index`
- `project:<current project slug>` for every project already present in `portfolioData`

Allowed dossier tabs are `instinct`, `approach`, and `output`. The target vocabulary is derived from repository data rather than repeated by hand.

### State and animation

The controller owns `hidden`, `entering`, `idle`, `listening`, `thinking`, `tool_use`, `talking`, `success`, `confused`, `error`, and `exiting`. Each state resolves to an allowed animation through the centralized asset adapter. Missing clips follow the requested fallback chain, with `idle` as the final fallback. Procedural clips use joint rotation and position changes. GLB clips use an animation mixer and short crossfades.

The controller stores only coarse screen behavior: state, active animation, horizontal anchor, facing direction, point direction, current target, current command, visibility, and failure status. It does not expose bones or arbitrary transforms to commands.

### Targets and site actions

`AvatarTargetRegistry` maps known semantic IDs to mounted elements and resolves live viewport bounds. React owners register elements by ref and unregister them on unmount. Bounds are read at execution time and refreshed after scroll, resize, and layout changes.

`SiteActionExecutor` receives application-owned callbacks from `PortfolioExperience`:

- `openProject` selects the matching current spatial project node.
- `closeProject` returns to the portfolio index.
- `activateTab` selects the matching project role in the dossier.
- `scrollTo` uses the registered element and native scrolling.
- `spotlight` and `clearSpotlight` set one semantic spotlight state rendered by the owning component.

No executor calls `querySelector`, evaluates code, or navigates to a generated URL.

### Sequences and cancellation

`AvatarSequenceRunner` validates before execution and runs one command at a time. Starting a new chat turn cancels the previous sequence. Cancellation clears waits immediately and prevents stale commands from changing the next turn. Missing targets and animations skip that spatial or playback command, warn in development, and continue.

Reduced motion removes travel, dramatic entrances, exits, and decorative waits. It preserves state changes, essential project selection, scrolling, highlighting, and the final stable position.

### Rendering

`AvatarOverlay` is lazy-loaded by `PortfolioExperience`. Its root uses fixed screen coordinates, a constrained bottom baseline, a clamped horizontal anchor, and `pointer-events: none`. Only the hide/show button accepts input. The canvas is small, transparent, and below the dossier and critical navigation. It pauses its frame loop while the document is hidden.

WebGL or model errors are contained by an avatar-only error boundary. The chat, dossier, routes, and main canvas continue. The persistent hide setting uses one versioned local-storage key and defaults to visible when storage is unavailable.

### Chat integration

`PortfolioChat` receives an avatar integration object from `PortfolioExperience`:

1. Submission cancels the prior turn and enters `thinking`.
2. Evidence moves to `tool_use`.
3. The first answer delta moves to `talking` without delaying text rendering.
4. A valid `effects` event runs application-owned site actions and the avatar sequence.
5. `done` returns to `idle` after queued effects.
6. Notice and error events move through `confused` or `error`, then recover to `idle`.

The protocol parser sanitizes effect payloads independently. Invalid effects produce no side effects while subsequent answer events continue.

## Development harness

With the development server running, `/?avatarDebug=1` opens a compact panel that can:

- set every state;
- play every allowed animation;
- enter from the left and exit to the right;
- look at the mounted base targets;
- clear the spotlight and simulate renderer failure;
- show the current state and animation;
- reset the controller.

Normal chat and structured protocol fixtures cover lifecycle, tool-use, success, cancellation, walk, look, point, and site-action sequences. The panel is absent from production bundles through a development guard.

## Tests and proof

Vitest covers validation, unknown input rejection, wait clamping, state-to-animation fallback, target registration and unmount, live bounds, sequence order and cancellation, reduced-motion command adaptation, site-action callbacks, stream effect sanitization, preserved text on invalid effects, shared assistant visibility, and chat lifecycle integration.

Rendered verification uses the existing Conductor workspace server and the bounded headless verification runner. It checks desktop, mobile, reduced-motion, `avatarDebug=1`, and WebGL smoke scenarios. Software WebGL proves deterministic startup only. Physical-device motion and final feel remain a walk item.

## Performance budget

- No new runtime dependency.
- Avatar code remains behind a dynamic import.
- The lazy avatar chunk requests a 1.52 MB GLB only when the overlay mounts; the procedural rollback adds no network asset.
- The avatar canvas uses a capped DPR and stops on hidden documents.
- The existing Three.js lazy chunk remains the primary bundle cost. Build verification records any material client-asset change.

## Bradley asset contract

The production GLB should contain a Mixamo-compatible humanoid rig when possible, 2,000 to 5,000 triangles, a 256 by 256 or 512 by 512 photographic texture, separate low-poly glasses attached to the head bone, and named clips mapped in the asset configuration. The adapter owns scale, facing direction, ground height, clip aliases, optional bone profile, frame stepping, texture filtering, and animation speed.

## Known limitations

- Pointing is a mirrored authored pose, not inverse kinematics.
- Movement follows a horizontal screen baseline rather than page physics.
- The model smoke test parses the production GLB and verifies its header, skin, configured clip names, and vertical bounds. The development harness exercises the same aliases against the running mixer.
- The current OpenAI provider emits conversational text with optional portfolio citations. Safe effect events can arrive through the protocol and fixtures, but model-selected effects need a later provider contract that preserves answer streaming.
- SwiftShader verification does not prove physical GPU fidelity or motion feel.

## Bradley swap checklist

1. Add the source scan without deleting the placeholder.
2. Optimize or decimate the mesh to 2,000 to 5,000 triangles.
3. Auto-rig it with a Mixamo-compatible skeleton where possible.
4. Confirm model orientation, scale, and ground height in the harness.
5. Validate idle and walk deformation.
6. Map available clip names and fallbacks in the asset configuration.
7. Trigger every state and animation in the harness, then run command sequences through the protocol fixtures.
8. Add or attach the low-poly glasses to the head bone.
9. Optimize the final GLB and its 256 or 512 pixel texture.
10. Test desktop, iPhone, reduced motion, WebGL failure, and shared chat/avatar visibility.
11. Change the production model URL from the Quaternius placeholder to the Bradley GLB.
12. Keep the Quaternius and procedural configurations as rollback options.

## Recorded assumptions

- The user's instruction to proceed autonomously approves moving past the normal design-review pause.
- This Conductor workspace is already a fresh worktree at `origin/main`; creating a nested worktree would violate the workspace boundary and add no isolation.
- The actor starts visible because the brief asks for a visible placeholder, but the user can persistently hide it.
- A second small WebGL canvas is acceptable because deterministic viewport targeting matters more than sharing the moving world camera. Build and browser verification can still reject the choice if it causes a measurable regression.
