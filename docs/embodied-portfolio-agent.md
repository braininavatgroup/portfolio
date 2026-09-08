# Portfolio avatar

The portfolio has one optional Bradley avatar: a textured Meshy portrait. It
appears with chat, idles, plays one fixed agreement reaction when answer text
arrives, and can take one visitor-requested performance after that reaction: a
leisurely swim lap, a stroll along the floor, a wave, a dance, or a full turn. It is not an answer
channel; chat and navigation remain complete if WebGL fails.

Brain Food reuses the same avatar and the live portfolio map. Exact `Shift+G`
starts an untimed desktop session. Arrow keys or WASD steer a breaststroke
through every existing map node except Bradley. Eaten nodes and their incident
connections disappear. Eating the final node holds the next dance in rotation for
3 seconds, then restores the prior map selection and avatar visibility.
Escape cancels and restores immediately.

## Runtime

`PortfolioExperience` owns one `AvatarRuntime` through `useAvatarStage`.
`PortfolioChat` reports only turn start, first answer text, and validated
effects. Turn start cancels stale work, first text starts `agree_gesture`, and
the model-selectable actions are `swim_lap`, `stroll`, `dance`, `turn`, `wave`, and `brain_food`. The
runtime queues the performance behind the reaction and always returns to
`idle`.

The registered clips, all in `public/avatars/bradley-quiet-portrait.glb`:

- `idle` → `Idle` (Meshy `Idle_11`)
- `agree_gesture` → `Agree_Gesture`, retargeted from the earlier untextured
  export with the arms folded in from Meshy's wide A
- `wave` → `Wave_One_Hand`, a dedicated 4.1-second greeting retargeted from
  the earlier export; plays once, then restores the saved idle
- `full_turn_left` → `Full_Turn_Left`, plays once for an explicit turn-around
  request and returns to idle after the complete 8.83-second clip
- `swim_forward` → `Swim_Forward`; `swim_idle` → `Swim_Idle`, treading water
  while Brain Food is stationary; `swimming_to_edge` → `swimming_to_edge`, the
  climb-out that ends a swim lap at the dock, played once for its full
  5.03 seconds and held
- `walking` → `Walking`, `running` → `Running`, `back_left_run` →
  `BackLeft_run`: the stroll walks to the far end of the floor it stands on
  (inside the Guide pane when docked there), then backpedals home when the
  dock is within 480px and runs otherwise. Standing locomotion turns fully
  into profile toward its travel.
- eight dances (`step_hip_hop_dance`, `jazz_dance`, `cardio_dance`,
  `funny_dancing_02`, `all_night_dance`, `funny_dancing_03`, `not_your_mom`,
  `denim_pop_dance`) taken in rotation; a requested dance plays once through
  using the lengths pinned in `avatarDanceDurationsMs`. Waves, dances, and turns hold
  the final frame until the runtime returns to idle.

Every locomotion clip has its Meshy Hips X/Z travel removed on load so the
stage controller is the sole owner of position.

`AvatarOverlay` renders one pointer-transparent orthographic canvas.
`AvatarStageActor` maps CSS-pixel positions into it. Position updates move a
persistent outer group; they must never remount `AvatarAssetAdapter`, because
remounting resets the mixer to the model's bind pose. The adapter starts the
selected action in a layout effect so a loaded model is not painted in a
T-pose before its first animation begins. Breaststroke uses a `0.8` playback
rate.

The provider effect schema contains only `avatarAction`, with `"none"`,
`"swim_lap"`, `"stroll"`, `"dance"`, `"turn"`, `"wave"`, or `"brain_food"`. The provider chooses a performance
only when the visitor explicitly asks Bradley to swim, walk, wave, dance, or turn around.
Standalone wave, dance, and swim requests produce a social acknowledgment and
the matching action directly without a model call. “Wave hello”, “Can you dance?”,
and “Go for a swim” stay available in initial and follow-up suggestions. Negated,
third-person, topical, and mixed requests still use the conversational provider.
The client buffers effects until the first
answer delta has rendered, so motion never leads the answer.

## Brain Food

`useBrainFoodSession` owns the global shortcut, held keys, velocity, collision
set, completion, cancellation, and restoration. `PortfolioWorld` remains the
only map renderer and publishes each projected node position before and during
the session. Start chooses the clearest bounded point in that live field, and
idle frames cannot collect nodes; the visitor must move first.
The game does not create a portal, duplicate collectibles, a chooser, a timer,
or a result overlay. While it is active the map paints only floating nodes and
labels; every trunk, branch, and relation line returns on restore.

Normal movement tops out at 220 CSS pixels per second. Input supplies a desired
map-plane heading; the controller turns toward it at 2.2 radians per second and reduces
propulsion during a sharp change of course, so the avatar does not swim
backward while reversing. Reduced motion advances one bounded step per key
press. The model swims `swim_forward` while moving and treads water on `swim_idle`
below 16 pixels per second, while its center-anchored stage group moves. Its rig yaws through the horizontal X/Z
pool plane and independently pitches up to 90 degrees toward vertical travel,
keeping roll level. The Meshy clip's Hips X/Z root travel is stripped
at load time, leaving controller movement as the only translation source.
Collection sweeps the avatar-sized hit area between rendered positions and
uses viewport coordinates shared with the live map. The session pauses input
when the document is hidden and cancels if the viewport crosses into the
mobile layout.

## Failure and proof boundaries

Missing required clips or renderer construction failure mark only the avatar
runtime failed. `AvatarBoundary` contains lazy-load and render errors. The map,
reader, and chat remain usable.

Permanent tests cover the effect allowlist, reaction/lap ordering, cancellation,
all 18 required clips, continuous Brain Food mounting, movement integration,
collection, celebration, live-map removal, Escape restoration, reduced motion,
and renderer isolation. Software WebGL is smoke evidence; physical-GPU motion,
animation blending, and final feel remain human walk items.

### Brain Food from the Guide

“Play Brain Food” stays available in initial and follow-up suggestions on
desktop. It is hidden below 1020px and on coarse-pointer devices. Direct
play/start requests emit `brain_food` without a model call. The Guide still uses
the normal validated response lifecycle; the Experience owns starting the game.

`gameMode` temporarily renders Map in the main slot and expands it to the window.
The Room retains its underlying slots, collapsed views, panel dimensions, and
mobile tab without persisting temporary layout changes. No view remounts during
the desktop transition, and selection, URL, Reader, and Guide thread survive.
Two animation frames allow the Map to resize before the swimmer is placed.

Escape, the Exit Brain Food control, and completion restore the layout, focus,
and prior avatar visibility. Shift+G remains a keyboard shortcut. Play requires a keyboard, a fine pointer, and at least 1020px of width; an unavailable start shows
a status message instead of changing the layout.
