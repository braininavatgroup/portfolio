# Embodied portfolio agent

The portfolio includes an optional Bradley avatar that behaves as a small stage actor. It notices visitor attention, reflects answer lifecycle, relates to known page objects, moves beside those objects, and performs model-selected gestures. It is not a second answer channel: chat and navigation remain complete when the avatar is hidden, fails, or cannot resolve a target.

Production renders the exact Meshy model at `public/avatars/bradley-meshy-rigged.glb`. Native clips come from that model; `public/avatars/bradley-motion-library.glb` contributes additional motion without rendering its scene. The procedural actor remains a no-network renderer fallback.

## Architecture and data flow

1. `PortfolioChat` reports focus, typing, blur, turn start, evidence, first text, effects, notices, errors, and completion.
2. `PortfolioExperience` owns one `AvatarDirector`, `AvatarSequenceRunner`, `AvatarController`, `AvatarTargetRegistry`, and `SiteActionExecutor`.
3. `AvatarDirector` arbitrates lifecycle, visitor navigation, model-selected performance, and ambient attention. A new run cancels the previous sequence.
4. `AvatarSequenceRunner` executes the safe command list serially and passes its abort signal into the controller.
5. `AvatarController` publishes stable snapshots containing state, active clip, tone, target, anchor, time-bearing stage motion, facing, and pointing.
6. `AvatarOverlay` draws the transparent React Three Fiber stage in CSS-pixel coordinates and isolates it behind an avatar-only error boundary.
7. `AvatarAssetAdapter` renders one authored full-body clip while renderer-owned yaw, bounded sway, travel, playback rate, and crossfade timing run as independent layers.

The provider publishes a validated effect description immediately before answer text. The server puts that direction on the wire before the first validated answer delta, and the client buffers it until that delta has committed, so avatar work cannot get ahead of the primary text response.

Unknown keys and values are removed by `lib/avatar/validation.ts`. Model output never supplies JavaScript, selectors, URLs, CSS, bones, transforms, arbitrary numbers, or arbitrary animation names. Invalid effects do not interrupt answer text.

## Behavior contract

Avatar states are `hidden`, `entering`, `idle`, `listening`, `thinking`, `tool_use`, `talking`, `success`, `confused`, `error`, and `exiting`.

The first-class behavior catalog is defined in `lib/avatar/behaviors.ts`. It contains the twenty Meshy clips plus Orange Justice. Every behavior remains available whenever the provider or lab selects it. An ordinary answer selects one behavior; a requested performance or meaningful emotional progression may select two or three. Each selected clip carries its registry-owned visible hold, including the last clip, before turn cleanup returns the actor to idle.

The model also supplies:

- performance intent: `ordinary`, `expressive`, or `requested`;
- energy: `low`, `medium`, or `high`;
- warmth: `reserved` or `warm`;
- confidence: `uncertain`, `neutral`, or `assured`;
- mischief: `none` or `playful`.

Tone adjusts deterministic renderer values such as playback rate, crossfade duration, travel speed, and subtle sway. It never blocks the selected behavior.

Allowed avatar commands are:

| Command | Allowed payload | Behavior |
| --- | --- | --- |
| `setState` | one allowed state | Select the repository-owned behavior for that state. |
| `setTone` | the exact bounded tone object | Adjust renderer timing and subtle motion without changing the clip. |
| `play` | one registered behavior ID | Play that exact available behavior. |
| `wait` | finite `durationMs` | Pause the cancellable sequence; validation clamps to 0–10,000 ms. |
| `enter` | `from: "left" \| "right"` | Travel from the corresponding offscreen edge to the home anchor. |
| `exit` | `to: "left" \| "right"` | Travel offscreen and hide after uncancelled completion. |
| `walkTo` | one semantic target | Walk to the lowest-overlap position beside the target. |
| `swimTo` | one semantic target | Plan a clear aerial route to the target and return to its grounded dock. |
| `swimRoute` | `route: "lap"` | Run the repository-owned, obstacle-aware lap and return home. |
| `lookAt` | one semantic target | Face the live target without moving. |
| `pointAt` | one semantic target | Face and point toward the live target. |

Allowed site actions remain `openProject`, `closeProject`, `activateTab`, `scrollTo`, `spotlight`, and `clearSpotlight`. They execute through `SiteActionExecutor`, never through model-authored selectors.

## Direction and stage motion

Contextual direction is deterministic:

- focus or leading-edge throttled typing activity produces listening attention toward chat;
- submit looks toward chat before thinking;
- evidence produces tool-use motion;
- first committed answer text produces talking motion;
- project selection walks beside the mounted dossier and points;
- dossier tab changes retain project attention;
- closing a project returns attention toward the index;
- completion settles to idle and restarts ambient scoring.

The stage model uses a CSS-pixel foot point: `position.x` and `position.y` identify the actor's planted foot in the viewport, and the orthographic renderer maps that same point into the scene. The grounded floor is calculated from the viewport bottom and moves upward when the expanded Director console would otherwise cover the actor. `walkTo` evaluates candidate docks on both sides of the target. `lib/avatar/stage.ts` scores overlap count, overlap width, and travel distance, then clamps the dock inside the viewport.

Semantic targets identify things the actor may address (`hero`, chat, index, or a mounted project); they are not automatically forbidden space. Repository obstacles identify rectangles the actor must route around: the portfolio header and the expanded Director console. Grounded movement avoids both other target rectangles and obstacles. Swim planning uses the same registered geometry to route around targets, the header, and the expanded console; it never crosses a registered rectangle or clips itself through the viewport edge. Movement duration is derived from CSS-pixel path distance and bounded energy. The controller does not settle until travel completes or cancellation transfers ownership to another event.

Use only bounded commands, for example:

```ts
{ action: "swimTo", target: "portfolio:chat" }
{ action: "swimRoute", route: "lap" }
```

Ambient presence is a weighted choice between stillness and contextual glances. It excludes the immediately previous variant, runs only when the director is idle, and never selects arbitrary full-body clips. The timer stops while the document is hidden and cannot recreate itself after the director is stopped or disposed.

Reduced motion completes travel immediately and removes decorative waits, selected full-body performance, and ambient swimming or sway. It preserves stable targets, gaze, pointing, lifecycle state, page actions, and answer text. The overlay also collapses any remaining stage animation duration to zero. Hiding the avatar, enabling reduced motion, starting a newer sequence, and hiding the document each cancel current travel; a cancelled motion cannot later settle stale state.

## Semantic targets

The target vocabulary is derived from portfolio data:

- `hero`
- `portfolio:chat`
- `portfolio:index`
- every known `project:<slug>`

React owners register the element they render and unregister it by passing `null`. Bounds are read at command time and refreshed after scroll, resize, and visibility changes. A valid target that is not mounted is skipped without DOM queries or answer failure.

## Development lab

Run the development server and open `/?avatarLab=1`. The isolated lab includes chat, the real WebGL avatar, mounted target blocks, and the full Director console.

The Director console has four tabs:

- **Scenes** runs Greet, Present project, Answer, Celebrate, Dance, Swim lap, and Come home recipes.
- **Target** shows the live stage map, selects a semantic target, and provides Walk, Swim, Look, Point, Present, and Spotlight actions.
- **Movement** provides enter/exit from either edge, a lap, target swim, and home dock.
- **Advanced** provides bounded state, tone, and behavior controls; contextual event simulations; spotlight controls; renderer-failure simulation; reset; and live position, locomotion, path, facing, target, and tone diagnostics.

The status controls are Stop, Reset avatar, Hide/Show assistant, and Collapse/Expand console. The expanded console is itself registered as an obstacle, so its bottom-sheet layout remains clear of travel routes.

`/?avatarDebug=1` exposes the same panel over the normal portfolio in development. The persistent Hide assistant / Show assistant control remains outside the harness.

## Asset adapter

`lib/avatar/config.ts` owns the model URL, external motion URL, scale, forward axis, ground offset, base playback rate, target frame rate, material flags, and optional glasses attachment. The visible Meshy scene is mounted once. Native clips win when the external library contains the same clip name.

The recoverable Meshy source and exact build contract live in `assets/avatar-sources/README.md`. Rebuild public avatar files with:

```bash
npm run build:avatar
```

Do not transform or overwrite the recoverable source by hand.

## Troubleshooting

**The model is missing.** Verify the two configured `/avatars/` URLs and the public files. A null model URL intentionally renders no GLB actor.

**A behavior does not play.** Compare its exact `clipName` in `lib/avatar/behaviors.ts` with the union of native and motion-library clips. The controller marks the isolated avatar failed when a registered behavior is unavailable.

**A target command does nothing.** Confirm the target owner mounted and registered a live element. Project targets exist only while their dossier or lab block is mounted.

**Travel snaps or completes late.** Inspect snapshot `motion`, the CSS-pixel foot point, the planned path, and the runner abort signal together. Do not add detached movement timers in React.

**WebGL fails.** The avatar boundary removes only the renderer. Chat, navigation, dossier, and Director reset controls remain usable. SwiftShader establishes deterministic smoke evidence, not physical-GPU feel.

**A sequence continues after ownership changed.** Every new runner call aborts the prior one. Movement completion also verifies that its motion ID still owns the snapshot.

**The hide preference does not stick.** The versioned key is `portfolio-avatar-enabled:v1`; clear it to restore the visible default.

## Proof boundary

Permanent tests cover the bounded contract, every behavior, no-repeat ambient selection, priority, cancellation, collision-aware geometry, travel duration, renderer mappings, chat lifecycle, direct navigation, provider timing, reduced motion, and lab controls.

Combined browser evidence is written to `.context/verification/full-page-avatar-stage-2026-08-26` when the local verifier is available. It covers desktop and mobile lab scenarios, including reduced motion, target routing, console controls, lifecycle cancellation, renderer isolation, and chat. SwiftShader proves the deterministic WebGL smoke lane only; motion feel, animation blending, physical-device GPU rendering, accessibility, and final likeness remain human walk items.
