# Full-page avatar stage and Director console design

**Ticket:** PER-15

## Goal

Replace the avatar's small moving render box and dense developer control wall with a viewport-wide stage and an operator-friendly Director console. The avatar stays grounded for ordinary navigation, can swim through open page space, understands visible interface regions as physical obstacles and targets, and never loses the existing safe command boundary.

## Product decisions

- Render the avatar in one fixed, transparent, viewport-wide WebGL canvas. The actor is clipped only by the browser viewport during intentional entry and exit.
- Keep a grounded floor lane for walking, running, entering, exiting, and ordinary target navigation.
- Add free x/y swimming through open page space. Direct scenes, model-selected swimming performances, and idle direction may start a swim.
- Treat registered interface rectangles as stage geometry. Targets supply interaction points; non-target interface regions supply collision bounds.
- Replace the default raw control list with a Director console. Keep every existing state, behavior, tone, target, failure, and diagnostic control under Advanced.
- Keep chat and navigation complete if WebGL, motion, or stage routing fails.
- Add no runtime dependency and no production capability.

## Stage coordinate system

The controller moves from a single `anchorX` to a screen-space foot position `{ x, y }`. Positions and paths use CSS pixels because DOM targets already report CSS-pixel rectangles and the operator needs paths that match the visible interface.

`AvatarStageMotion` becomes a time-bearing path:

- stable motion ID;
- kind: `enter`, `walk`, `exit`, or `swim`;
- locomotion: `grounded` or `swimming`;
- ordered screen-space points;
- total duration.

The actor's stable position is the final path point. Renderer interpolation samples the path while the controller's cancellable completion timer retains sequence ownership. A newer command aborts the path and prevents its completion from overwriting current state.

The grounded floor is a horizontal lane near the bottom safe area. In the avatar lab, an expanded Director console raises the floor to the console's top edge. Normal portfolio pages use the viewport bottom safe inset. Walking changes x only.

## Full-page renderer

`AvatarOverlay` becomes `position: fixed; inset: 0` with `pointer-events: none`. One transparent React Three Fiber canvas spans the viewport. Interactive DOM stays above the canvas and keeps pointer ownership.

An orthographic camera makes screen-to-world mapping deterministic. The stage actor converts CSS-pixel foot coordinates into orthographic world coordinates and keeps the visible model at the current approximate pixel height across viewport sizes. The model, motion library, animation mixer, tone, reduced-motion mapping, renderer boundary, shared assistant visibility, and availability checks remain unchanged.

The renderer samples each path on animation frames. Grounded paths remain horizontal and use the walking or running clip. Swim paths follow all x/y waypoints and use a registered swimming clip. Facing follows the current segment. Pointing and gaze still resolve from the actor's foot position to the target center.

The Director console retains development visibility controls. The public portfolio uses the compact chat bubble to reveal or minimize the chat and avatar together.

## Interface map and routing

`AvatarTargetRegistry` remains the semantic target source for `hero`, `portfolio:chat`, `portfolio:index`, and project targets. It also accepts repository-owned obstacle registrations for visible interface regions such as the header and Director console. Obstacle IDs never enter model output.

Every target produces bounded candidate interaction points:

- grounded docks to its left and right on the floor lane;
- swimming docks to its left, right, top, and bottom;
- its center for gaze and pointing.

The stage planner inflates visible rectangles by the actor's half-width plus a gap. Grounded placement keeps the existing lowest-overlap side selection. Swimming uses a visibility graph built from the start, destination candidates, and padded obstacle corners. Edges that intersect an obstacle are removed, and the shortest remaining route wins. This fits the small number of portfolio regions, stays deterministic, and needs no pathfinding dependency.

If a route is unavailable, target-directed movement skips without failing chat. An ambient swim that cannot find a closed route returns to idle without moving. Scroll, resize, visibility return, target mount, and target unmount refresh the stage map before the next path.

## Swimming behavior

Swimming is a real locomotion mode, not vertical walking.

- A direct Swim scene starts a repository-owned lap through open viewport regions and returns to the nearest grounded dock.
- A target swim uses the shortest safe swimming dock around that semantic target.
- When a validated answer sequence selects `swim_forward` or `swimming_to_edge`, the director pairs that clip with the repository-owned lap route when a safe route exists. Without a safe route, it plays the selected clip in place.
- Idle direction may choose an ambient swim only when no turn, visitor action, or sequence owns the actor.
- A new turn, direct scene, hide action, reduced-motion change, or document hide cancels the swim.
- The avatar docks and returns to grounded idle after every completed swim.

Ambient selection retains the existing no-immediate-repeat rule. It may choose swimming whenever the stage has a safe route; no separate availability policy suppresses an accepted selection.

## Director console

The avatar lab opens with a bottom Director console rather than the raw scrolling control wall. It can collapse to a compact status bar so the whole stage remains visible.

The header reports current state, clip, target, locomotion mode, and failures in plain language. It contains Stop, Reset, Hide, and collapse controls.

The console has four tabs:

1. **Scenes** presents large one-click routines: Greet, Present project, Answer, Celebrate, Dance, Swim lap, and Come home. Each scene calls the same director, runner, controller, and site-action interfaces used by the live portfolio.
2. **Target** shows a live miniature of registered stage regions. Selecting a region exposes only the applicable actions, such as Walk, Swim, Look, Point, Present, and Spotlight.
3. **Movement** provides grounded and swimming entrances, exits, routes, and return-to-dock controls.
4. **Advanced** contains the complete state list, all twenty behavior clips, tone presets, context simulations, page actions, failure controls, and raw diagnostics.

Desktop uses a bounded bottom dock. Small screens use a bottom sheet with the same tab order, large touch targets, and no horizontal overflow. Closing or collapsing the console never cancels the avatar.

## Safe command changes

The shared command vocabulary gains semantic swimming commands rather than arbitrary coordinates:

- `swimTo` with one known semantic target;
- `swimRoute` with the closed repository-owned route ID `lap`.

The model never supplies screen positions, obstacle IDs, path points, CSS, or selectors. Validation remains exact-key and closed-enum. Repository-owned Director scenes may compose safe commands with bounded waits and tone.

## Reduced motion and failure behavior

- Reduced motion disables travel and ambient swimming. Target selection, gaze, pointing, page actions, and stable docking remain available.
- The full-page canvas remains `aria-hidden` and pointer transparent.
- The Director console uses real tabs, buttons, labels, focus rings, and status text.
- Missing targets or routes skip movement without changing answer text.
- Missing clips or WebGL failure remove only the avatar renderer. The console reports the failure and keeps Reset available.
- A detached, hidden, or disposed director cannot recreate ambient or swim timers.

## Implementation boundaries

The change will touch the shared avatar contracts, stage geometry, target registry, controller, director, reduced-motion adapter, overlay renderer, asset adapter, Director console, portfolio target registrations, styles, and their tests. The chat provider, evidence model, site-action authorization, portfolio content, and deployment controls remain unchanged.

The already committed conversational-paragraph validation fix remains a separate change and receives its own verification.

## Proof

Permanent tests will cover:

- full-viewport stage coordinates and actor-size mapping;
- grounded floor invariants;
- obstacle inflation, dock selection, visibility-graph routing, and unavailable routes;
- swim path sampling, completion, cancellation, docking, and facing;
- direct and ambient swim arbitration;
- exact validation of the new semantic commands;
- reduced-motion adaptation;
- Director scene actions, target selection, tab semantics, Advanced coverage, Stop, Reset, and Hide;
- full-page overlay failure isolation and pointer transparency.

Repository tests, lint, production build, rendered Worker checks, and the chat regression suite must pass. Browser proof will attach to the existing workspace server and exercise desktop plus mobile reduced motion, a grounded walk around mapped UI, a free swim around mapped UI, Director console collapse and expansion, no actor self-clipping, no horizontal overflow, and no page, console, or request errors. Physical-device motion feel remains a human walk item.
