# Portfolio avatar

The portfolio has one optional Bradley avatar. It appears with chat, idles,
plays one fixed agreement reaction when answer text arrives, and can take one
visitor-requested leisurely swim lap after that reaction. It is not an answer
channel; chat and navigation remain complete if WebGL fails.

Brain Food reuses the same avatar and the live portfolio map. Exact `Shift+G`
starts an untimed desktop session. Arrow keys or WASD steer a breaststroke
through every existing map node except Bradley. Eaten nodes and their incident
connections disappear. Eating the final node holds the fixed celebration for
3 seconds, then restores the prior map selection and avatar visibility.
Escape cancels and restores immediately.

## Runtime

`PortfolioExperience` owns one `AvatarRuntime` through `useAvatarStage`.
`PortfolioChat` reports only turn start, first answer text, and validated
effects. Turn start cancels stale work, first text starts `agree_gesture`, and
the only model-selectable action is `swim_lap`. The runtime queues that lap
behind the reaction and always returns to `idle_3`.

The supported clip set is deliberately small:

- `idle_3` → `Idle_3`
- `agree_gesture` → `Agree_Gesture`
- `swim_forward` → `Swim_Forward`
- `cheer_with_both_hands` → `Cheer_with_Both_Hands`

`AvatarOverlay` renders one pointer-transparent orthographic canvas.
`AvatarStageActor` maps CSS-pixel positions into it. Position updates move a
persistent outer group; they must never remount `AvatarAssetAdapter`, because
remounting resets the mixer to the model's bind pose. The adapter starts the
selected action in a layout effect so a loaded model is not painted in a
T-pose before its first animation begins. Breaststroke uses a `0.8` playback
rate.

The provider effect schema contains only `avatarAction`, with `"none"` or
`"swim_lap"`. The provider chooses the lap only when the visitor explicitly
asks Bradley to swim or take a lap. The client buffers effects until the first
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
press. The model stays on `swim_forward` for the whole collection phase while
its center-anchored stage group moves. Its rig yaws through the horizontal X/Z
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
four required clips, continuous Brain Food mounting, movement integration,
collection, celebration, live-map removal, Escape restoration, reduced motion,
and renderer isolation. Software WebGL is smoke evidence; physical-GPU motion,
animation blending, and final feel remain human walk items.
