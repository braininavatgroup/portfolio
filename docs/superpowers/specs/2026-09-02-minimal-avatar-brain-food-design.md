# Minimal avatar and map-native Brain Food design

**Status:** Approved for implementation

## Goal

Replace the portfolio's broad avatar orchestration system with a small chat
presence and move Brain Food onto the existing map. Bradley appears with chat,
idles, performs one fixed reaction when an answer arrives, and swims only when
the visitor explicitly requests a lap or starts Brain Food.

## Product contract

### Normal chat presence

- Closing chat hides Bradley. Opening chat places him at the chat dock in
  `idle_3`.
- The first valid answer text starts `agree_gesture` once, then returns Bradley
  to idle.
- A new question or closing chat cancels the active performance cleanly.
- The language model no longer selects arbitrary animations, sequences, tone,
  targets, waits, or coordinates.

### Visitor-requested swim

- A suggested chat prompt and an explicit visitor request may produce one
  narrow `swim_lap` effect.
- Bradley finishes the normal answer reaction before starting the lap.
- The application owns the route, speed, breaststroke clip, and return to the
  chat dock. The model cannot alter them.
- The lap is leisurely and uses `swim_forward`. It never starts automatically.

### Brain Food

- Exact `Shift+G` starts Brain Food immediately when the desktop map and avatar
  renderer are available.
- Starting a round saves the current map selection and composition. The map
  switches to a clear game composition with every portfolio node except
  Bradley visible and edible.
- WASD and arrow keys steer Bradley in two dimensions. Motion uses
  `swim_forward` with low acceleration, a modest top speed, long coasting, and
  gentle direction changes so it reads as breaststroke underwater.
- Touching a node draws its mark and label into Bradley, removes the node from
  the round, and removes any connector with that node as an endpoint.
- The map shows a small remaining-count and Escape instruction. Brain Food has
  no chooser, timer, score challenge, duplicate node field, modal, or result
  card.
- Eating the last node plays `cheer_with_both_hands`, then restores the exact
  pre-game map state. Escape restores it immediately without celebration.
- Map selection and node dragging pause during the round.

## Architecture

The normal avatar uses a small explicit state with `hidden`, `idle`,
`reacting`, and Brain Food ownership. It retains the current Meshy GLB loader,
clip crossfading, renderer failure boundary, full-page pointer-transparent
canvas, stage coordinate conversion, and reduced-motion containment.

`PortfolioExperience` owns chat visibility, the normal reaction trigger, the
optional swim-lap queue, and Brain Food activation. A focused Brain Food
session owns held keys, frame timing, avatar position, eaten node IDs, and the
saved map state. `PortfolioWorld` remains the authority for projected node
positions. In game mode it publishes those positions to the session, omits
eaten nodes and affected connectors, and disables normal pointer behavior.

The visitor-requested lap keeps one application-owned route through the visible
map area. Target-directed walking and swimming, semantic target registration,
general obstacle routing, ambient scheduling, tone, sequence interpretation,
and development direction controls are removed.

The server output contract replaces the open avatar command sequence with an
optional closed action whose only value is `swim_lap`. Normal answer reaction
timing remains client-owned and does not depend on model output.

## Deletions

- Toss Bradley, pointer-throw integration, bounce physics, toss results, and
  their tests.
- The toybox chooser, portal overlay, duplicate collectibles, timer, result
  card, focus trap, inert shell lease, and toybox renderer boundary.
- Agent-selected animation catalogs and sequences, avatar tone, arbitrary
  waits, pointing, target-directed walking and swimming, and automatic
  swimming.
- The general avatar director, sequence runner, target registry, ambient
  scheduler, Director console, and the development keyboard toggle.
- Runtime configuration and documentation that describe removed behavior.

Code may retain a narrow existing helper when it directly implements the fixed
chat dock or single lap and is smaller than replacing it. Removed concepts must
not remain as dormant public contracts.

## Reduced motion and failure behavior

- Reduced motion suppresses route travel and continuous swimming. Bradley may
  settle directly into the destination or stable idle state without blocking
  answer text.
- Brain Food uses bounded direct key steps with no coasting under reduced
  motion. Node consumption and state restoration still work.
- Missing clips or WebGL failure disable only the avatar and Brain Food. Chat
  and the portfolio map remain usable.
- Hiding the document pauses Brain Food input and frame work. A viewport change
  that removes the desktop map cancels the round and restores normal state.

## Verification

Permanent tests cover the small normal state transitions, reaction then lap
ordering, cancellation, exact parsing of the optional `swim_lap` action,
leisurely Brain Food integration, collision, eaten-node rendering, keyboard
ownership, completion restoration, Escape restoration, reduced motion, and
avatar-only failure containment.

Repository tests, lint, and the production build must pass. Browser proof uses
the workspace's existing server and exercises chat open and close, answer
reaction, explicit swim request, Brain Food entry, several pickups, completion,
Escape, and map restoration. Software WebGL is smoke evidence. Motion feel and
the exact clip choices remain physical-device acceptance items.
