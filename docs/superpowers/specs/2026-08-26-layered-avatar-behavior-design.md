# Layered avatar behavior design

**Ticket:** PER-15

## Goal

Turn the portfolio avatar from a one-clip reaction player into a small stage actor that notices the visitor, relates to page objects, moves through screen space, and performs model-selected gestures with restraint.

## Product direction

The avatar shares a stage with the portfolio. It is not a second answer channel and it is not a looping sticker. Text remains complete without motion. Motion shows attention, intention, attitude, and spatial relationships that are already visible in the page.

Believability comes from causality and timing. The avatar looks because the visitor focused the chat, moves because a project opened, points toward the mounted project, and settles when the action ends. Ambient activity cannot interrupt a turn.

## Scope decisions

- Keep the existing GLB, motion library, safe command vocabulary, target registry, renderer boundary, and shared assistant visibility contract.
- Add no runtime dependency and no live capability. This is dormant branch code until the normal review and release path activates it.
- Preserve the existing rule that avatar work never delays, clears, or invalidates answer text.
- Use one full-body authored clip at a time. Layer independent stage translation, attention yaw, ambient sway, and tone-driven playback around that clip. The current asset does not contain a facial rig or animation masks, so this phase does not pretend to provide facial performance or true upper-body masking.
- Keep model control semantic and bounded. The model may choose known behavior IDs, a bounded performance intent, and enum-valued tone controls. It never receives bones, selectors, transforms, URLs, CSS, or arbitrary numbers.
- Make reduced motion a distinct score rather than a broken version of the normal score. It removes traversal, decorative waits, selected full-body performances, and ambient sway while preserving useful gaze and stable page actions.

## Behavior layers

### Full-body performance

The existing `play` and `setState` commands continue to select authored clips. Behavior definitions gain default tone metadata. Every registered performance remains available whenever the agent selects it. Runtime policy does not throttle large, comic, or dramatic clips.

### Attention

Attention remains a safe semantic target or coarse direction. It is rendered independently from the full-body clip with damped yaw. Contextual attention is deterministic:

- focusing or typing in chat looks toward the chat;
- submitting looks toward chat before thinking;
- opening a project looks toward the mounted project target;
- changing dossier tabs keeps attention on that project;
- closing a project returns attention to the index;

### Stage motion

`walkTo`, `enter`, and `exit` become time-bearing commands. The controller computes a duration from travel distance and energy, publishes a motion record with start and end anchors, and resolves the command only when the motion completes or the turn cancels it. The overlay animates the screen-space path with the Web Animations API while the GLB plays the walking clip.

The destination is adjacent to the semantic target rather than over its center. A pure stage-layout function evaluates left and right candidates against viewport bounds and all mounted target rectangles, then chooses the lowest-overlap candidate with distance as the tie-breaker. The chat, dossier, index, hero, and mounted project targets therefore act as stage obstacles.

### Ambient presence

Idle presence is a weighted score of stillness and contextual glances, not random full-body clips. The director owns a recursive idle timer, excludes the last variant, and chooses only while no chat turn or higher-priority sequence is active. Variants adjust attention and subtle renderer sway. They do not move the avatar across the stage.

### Tone

The safe tone vocabulary is:

- energy: `low`, `medium`, `high`;
- warmth: `reserved`, `warm`;
- confidence: `uncertain`, `neutral`, `assured`;
- mischief: `none`, `playful`.

Tone changes playback rate, travel speed, crossfade duration, and ambient amplitude through deterministic mappings. The language model may select the tone for its answer. Lifecycle and visitor events use repository-owned defaults.

## Direction and arbitration

`AvatarDirector` becomes the single behavior owner above the controller and sequence runner. It accepts visitor, chat, portfolio, ambient, and agent-performance events. Priority is explicit:

1. a new chat turn cancels all previous work;
2. agent answer performance may replace lifecycle talking after the first text render;
3. visitor navigation cancels ambient work but does not clear answer text;
4. ambient work runs only when the director is idle.

The controller remains a rendering-state store. The sequence runner remains the cancellable serial executor.

## Answer timing

The provider emits the validated effect description before yielding answer text. The client already buffers effects until the first answer delta has committed. This order starts the score directly after first-text render instead of after the complete answer event, without delaying text.

The provider chooses one behavior for ordinary answers and up to three for a requested performance or meaningful progression. It also classifies the performance intent as `ordinary`, `expressive`, or `requested` and supplies the bounded tone. The director plays the complete validated selection whenever it is selected.

## Development lab

The avatar lab remains the rough instrument panel. It gains:

- tone presets and live tone readout;
- real walk, look, and point controls for mounted lab targets;
- enter and exit from both edges;
- contextual event controls for focus, typing, submit, evidence, first text, completion, project open, tab change, and project close;
- project-hosting, tab-change, project-close, and multi-behavior performance scenarios;
- motion, target, and tone diagnostics;
- fixed lab target blocks so spatial behavior can be exercised without the full portfolio scene.

The raw clip catalog remains available for taste review.

## Accessibility and failure behavior

- Reduced motion preserves text, target selection, gaze, spotlight, and final stable position.
- Ambient timers stop while the document is hidden and restart only after returning to idle.
- A missing target skips the spatial action without failing the answer.
- A missing clip marks the avatar failure state but leaves the site usable.
- The avatar remains `aria-hidden`; the hide/show control remains its only required accessible UI.
- Cancellation prevents an old movement completion from changing a newer turn.

## Proof

Permanent tests cover behavior metadata, no-repeat ambient selection, bounded tone parsing, target-side stage placement, collision avoidance, distance-based motion duration, cancellation, director priority, chat-input events, project reactions, effect-before-answer ordering, reduced motion, renderer mappings, and lab controls.

Browser proof attaches to the existing workspace server on port 3315. The current run records desktop and 390 by 844 reduced-motion screenshots, runs a SwiftShader WebGL smoke check, exercises tone, target travel, context, and direct behavior controls, and fails on page errors or missing WebGL. Physical-device motion, exact gesture feel, and final Bradley likeness remain human walk items.
