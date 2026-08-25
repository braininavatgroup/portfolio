# Embodied portfolio agent

The portfolio includes a small, optional assistant that mirrors chat activity and can direct attention to known portfolio content. It is deliberately separate from the main spatial scene: `PortfolioExperience` owns the behavior objects, while `AvatarOverlay` renders a lazy, transparent React Three Fiber canvas at a stable screen position.

The current actor is the rigged `Casual_2` character from Quaternius's CC0 Ultimate Modular Men pack. The 3.06 MB source glTF is preserved at `assets/avatar-source/quaternius-casual-2.gltf`; production loads the converted 1.52 MB GLB at `public/avatars/quaternius-casual-2.glb`. The procedural actor remains a no-network rollback. Chat, commands, target registration, and site actions do not depend on the asset format.

## Architecture and data flow

The behavior path is:

1. `PortfolioChat` reports lifecycle events and independently validates any optional `effects` stream event.
2. `PortfolioExperience` maps lifecycle events to coarse states and sends validated site actions to `SiteActionExecutor`.
3. `AvatarSequenceRunner` runs avatar commands in order. A new turn, unmount, or hidden document cancels the active sequence.
4. `AvatarController` resolves states to allowed animations and translates semantic target bounds into screen position, facing, and pointing direction.
5. `AvatarOverlay` subscribes to the controller and passes only the active animation, facing, and pointing direction into `AvatarAssetAdapter`.
6. `AvatarAssetAdapter` renders either `ProceduralAvatar` or a configured GLB. It is the only asset-specific boundary.

Unknown keys and values are removed by `lib/avatar/validation.ts`. Model output never supplies JavaScript, selectors, URLs, CSS, bones, transforms, or arbitrary animation names. Invalid effects do not interrupt answer text.

The chat lifecycle uses `thinking` when a turn starts, `tool_use` when evidence arrives, `talking` after the first text delta, `confused` for a notice, `error` for an error, and `idle` on completion. The live OpenAI provider currently emits grounded text, evidence, notices, and errors only. The protocol and client support safe `effects`, but model-selected effects require a later provider contract that preserves the citation stream.

## Allowed behavior vocabulary

Avatar states are `hidden`, `entering`, `idle`, `listening`, `thinking`, `tool_use`, `talking`, `success`, `confused`, `error`, and `exiting`.

Allowed animation aliases are `idle`, `walk`, `think`, `talk`, `point`, `present`, `celebrate`, and `confused`. `avatarAsset.animations` maps each alias to an asset clip name. A state consults `avatarAsset.stateFallbacks` in order; if no configured clip is available, it settles on `idle`. A direct `play` command for a missing animation is ignored.

Allowed avatar commands are:

| Command | Allowed payload | Behavior |
| --- | --- | --- |
| `setState` | one allowed state | Resolve the state through its animation fallback chain. |
| `play` | one allowed animation alias | Play an available animation without accepting an arbitrary clip name. |
| `wait` | finite `durationMs` | Pause the sequence; validation clamps the value to 0–10,000 ms. |
| `enter` | `from: "left" \| "right"` | Show the actor at the corresponding viewport edge. |
| `exit` | `to: "left" \| "right"` | Enter the exiting state and face the chosen edge. |
| `walkTo` | one semantic target | Move the horizontal anchor to the target center and face it. |
| `lookAt` | one semantic target | Face the target without moving the anchor. |
| `pointAt` | one semantic target | Face and point toward the target. |

Allowed site actions are:

| Action | Allowed payload | Application-owned result |
| --- | --- | --- |
| `openProject` | a known `project:<slug>` target | Select that project's spatial node. |
| `closeProject` | none | Return to the portfolio index. |
| `activateTab` | `instinct`, `approach`, or `output` | Select that role for the open project. |
| `scrollTo` | one semantic target | Scroll to its live registered bounds. |
| `spotlight` | one semantic target | Apply the owned highlight state. |
| `clearSpotlight` | none | Remove the highlight state. |

Reduced motion removes `enter`, `exit`, and `wait`, and adapts `walkTo` to `lookAt`. State changes, selection, scrolling, highlighting, and stable facing remain.

## Semantic targets

The complete target vocabulary is derived from `portfolioData`, not from model input:

- `hero`
- `portfolio:chat`
- `portfolio:index`
- `project:kickoff-intake`
- `project:pitching`
- `project:reporting`
- `project:real-estate-deal-tracker`
- `project:touring-advancing-tool`
- `project:dubs`
- `project:three-maturity-bundle`
- `project:personal-tooling`
- `project:spec-discipline`

React owners register the element they render and unregister it by passing `null`. Bounds are read at command time and refreshed after scroll, resize, and visibility changes. Use the shared callback rather than selectors:

```tsx
const setProjectRef = useCallback(
  (element: HTMLElement | null) => {
    registerAvatarTarget?.(`project:${project.slug}`, element);
  },
  [project.slug, registerAvatarTarget],
);

return <aside ref={setProjectRef}>{project.title}</aside>;
```

A target that is valid but not mounted is skipped. It does not fall back to a DOM query.

## Development harness

Start the development server and open `/?avatarDebug=1`. Both conditions are required: the query does nothing in a production build, and the harness module is excluded by the build-time development guard.

The panel shows the current state and animation. It can select every allowed state and animation, enter from the left, exit to the right, look at the mounted base targets, clear the spotlight, simulate an avatar failure, and reset the controller. Use normal chat interactions and protocol fixtures for lifecycle/effect sequences. The persistent Hide assistant / Show assistant control remains outside the development harness.

## Asset adapter

`lib/avatar/config.ts` exports the single `avatarAsset` configuration. These are the asset adjustment points:

- `kind`: `procedural` or `gltf`.
- `modelUrl`: the public GLB URL; it must be non-null when `kind` is `gltf`.
- `skeletonProfile`: documents the procedural, generic humanoid, or Mixamo rig profile.
- `scale`: uniform GLB scale.
- `forwardAxis`: `z` or `-z`; the adapter combines this correction with left/right facing.
- `groundOffset`: vertical placement of the GLB root.
- `playbackRate`: clip time scale.
- `targetFrameRate`: `null` for continuous mixer time or a number for stepped animation time.
- `flatShading`: applies flat shading to every GLB mesh material.
- `nearestTexture`: changes mapped textures to nearest-neighbor minification and magnification.
- `animations`: safe aliases to exact GLB clip names.
- `stateFallbacks`: ordered alias fallbacks for each controller state.

The production GLB has one humanoid skin and 24 embedded clips. The safe aliases currently map to the non-combat `Idle`, `Walk`, `Idle_Neutral`, `Interact`, and `Wave` clips. A model smoke test parses the shipped GLB and fails if the rig, file format, configured clips, or overlay framing are lost. The procedural actor uses authored joint poses for the same aliases and does not load a model or texture. The GLB path loads with `useGLTF`, reports the aliases actually available in the loaded model to the controller, applies scale/orientation/ground correction at its root, updates material and filtering flags, and crossfades clips over 0.2 seconds.

The model comes from [Quaternius's Ultimate Modular Men pack](https://quaternius.com/packs/ultimatemodularcharacters.html) under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The exact upstream license notice is stored beside the production model, and `assets/avatar-source/PROVENANCE.md` records the acquisition date, public source identifiers, hashes, and conversion command. Rebuild the derived GLB without changing the source file:

```bash
npx @gltf-transform/cli@4.4.2 copy \
  assets/avatar-source/quaternius-casual-2.gltf \
  public/avatars/quaternius-casual-2.glb
```

Before adding an optimized asset, preserve the source scan outside the generated output path. A representative optimization pass is:

```bash
npx @gltf-transform/cli inspect public/avatar-source.glb
npx @gltf-transform/cli optimize public/avatar-source.glb public/avatar.glb --texture-compress webp
```

Do not optimize in place. Keep `avatar-source.glb` as the recoverable source and point `modelUrl` only at the optimized deliverable.

## Troubleshooting

**The model is missing.** Confirm `kind: "gltf"`, verify that `modelUrl` is `/avatars/quaternius-casual-2.glb`, and confirm the file is served from `public`. A null GLB URL intentionally renders no actor. Set `kind: "procedural"`, `modelUrl: null`, and `skeletonProfile: "procedural"` for the immediate no-asset rollback.

**A clip does not play.** Compare the names reported by the source GLB with `avatarAsset.animations`, including case. Ensure each state has a usable fallback and retain `idle` as its final entry. Missing direct-play clips are ignored; missing state clips continue down the fallback chain.

**A target command does nothing.** Confirm the target is in `allowedAvatarTargets`, that its owner registered a live element, and that the relevant view is mounted. A valid project dossier target is available only while that dossier is open. Registration must be cleaned up with the same target and element.

**WebGL fails.** The avatar error boundary marks only the avatar renderer failed. Chat, navigation, dossier, and the main scene continue, and the user can still change the persistent assistant preference. Check the browser console and test the HTML `/index` route separately. Software-rendered WebGL is smoke evidence, not physical-GPU proof.

**A sequence continues after it should stop.** Every new `run` aborts the prior sequence, and a new chat turn, unmount, or hidden document also cancels it. An executor added later must honor its `AbortSignal`; do not create detached timers outside the runner.

**The hide preference does not stick.** The versioned key is `portfolio-avatar-enabled:v1`, storing the string `false` only when disabled. Storage exceptions intentionally fall back to visible and must never break the page. Clear that key to restore the default.

## Current limitations and proof boundary

- The current character is a neutral temporary game asset, not a Bradley likeness.
- Pointing is an authored mirrored pose, not inverse kinematics.
- Movement follows a clamped horizontal screen baseline rather than page physics.
- The live provider does not yet select site actions or avatar sequences.
- The development harness is deliberately smaller than a production authoring tool; structured protocol fixtures cover full sequences.
- Software WebGL cannot establish physical GPU fidelity, motion quality, haptics, or final feel.

Automated artifacts for the GLB pass live under `.context/verification/per-1-real-avatar-framed` and `.context/verification/per-1-real-avatar-interactions`. The bounded browser run covered desktop, a 390 by 844 mobile viewport, debug controls, hide/show, request and console failures, and SwiftShader WebGL 2 smoke. The remaining acceptance step is a Bradley walk on an iPhone and a representative desktop GPU, including reduced motion, WebGL failure, animation feel, and the persistent hide preference.

## Bradley model-swap checklist

1. Add the source scan without deleting the placeholder.
2. Optimize or decimate the mesh to 2,000–5,000 triangles.
3. Auto-rig it with a Mixamo-compatible skeleton where possible.
4. Confirm model orientation, scale, and ground height in the harness.
5. Validate idle and walk deformation.
6. Map available clip names and fallbacks in the asset configuration.
7. Trigger every state and animation in the harness, then run command sequences through the protocol fixtures.
8. Add or attach the low-poly glasses to the head bone.
9. Optimize the final GLB and its 256 or 512 pixel texture.
10. Test desktop, iPhone, reduced motion, WebGL failure, and hide preference.
11. Change the production model URL from the Quaternius placeholder to the Bradley GLB.
12. Keep both the Quaternius and procedural configurations as rollback options.
