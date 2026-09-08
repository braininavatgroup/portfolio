# Local avatar pose editor

Open `/scripts/avatar/pose-studio.html` on this workspace's development server.
For the Victoria workspace that is
`http://localhost:55020/scripts/avatar/pose-studio.html`.

This is a standalone Vite authoring page under `scripts/`, not an application
route. It is not included in the portfolio build. It uses the existing workspace
server and the current `public/avatars/bradley-quiet-portrait.glb`.

## Using it

- Drag a large hand or foot handle. The elbow or knee follows without stretching
  the limb. The smaller handle changes the direction in which that joint bends.
- Drag empty space to orbit and scroll to zoom. Front, Side, Back, and Fit avatar
  reset the camera to useful views. Head & shoulders zooms in on the upper body.
  Use Side to judge depth and posture.
- Choose a limb in the right panel and use the one-centimetre buttons for smaller
  changes. A focused handle also accepts arrow keys; Page Up/Down changes depth
  along the camera view. Shift makes keyboard steps five centimetres.
- Select a hand to show its wrist controls. Bend, Side to side, and Palm twist
  rotate the hand independently. Straighten wrist clears bend and side angle
  while keeping palm twist; Reset wrist restores the shipped local wrist angle.
  Neither operation moves the wrist position, arm, or legs.
- Hands follow the forearm when dragged and keep the chosen local wrist angle.
  Feet keep their orientation relative to the ground.
- Switch to **Posture** to adjust the head, neck, chest/upper back, middle back,
  lower back, either shoulder, or pelvis. Select Head and move Chin up/down to
  lift the chin. Each point has three rotation sliders; positive values move in
  the first direction named in the label. Zero is the shipped idle posture.
- Posture changes retain existing limb and wrist offsets. Arms follow the torso
  and shoulders as those joints rotate. Reset this point clears only the selected
  posture point; Reset posture only clears the body controls and retains limb
  and wrist edits. Both operations can be undone.
- Preview idle plays the pose adjustment over the existing animation. Pause
  returns to the editing frame. Editing is disabled during playback.
- Undo and Redo keep up to fifty changes in the current visit. Cmd/Ctrl+Z and
  Cmd/Ctrl+Shift+Z work too. Reset pose returns to the currently shipped idle,
  including its existing shoulder correction. Reset can be undone.

## Saving and sharing

**Save draft** stores the pose in this browser's local storage, under
`portfolio-avatar-pose-draft-v1`. Reloading the same origin restores it. Different
browsers, hostnames, and ports have separate storage. Browser storage errors are
reported and Download pose remains available.

**Download pose** exports `bradley-idle-pose.json`. Send that file back to the
coding agent to apply it through the avatar asset pipeline. Saving or downloading
does not replace the model file or activate a portfolio change.

The accepted 2026-09-08 download is stored at
`assets/avatar-sources/bradley-idle-pose.json` and baked into Idle by
`npm run build:avatar`. The build verifies the draft's baseline hash before
applying it. After baking, the model has a new hash and the accepted posture
is its new zero. Older browser drafts are rejected for that new model; reset
and save a fresh draft to start editing from the accepted pose.


**Import pose** accepts a previously downloaded JSON file. The draft contains
version 1, the `Idle` clip, the SHA-256 digest of the exact avatar file, and local
quaternion offsets for edited joints. A different model, unsupported version,
unknown joint, or invalid rotation is rejected without replacing the open pose.

## Applying a later edit

A downloaded pose is an adjustment to the exact model currently in the editor.
After an accepted pose is baked, combine subsequent adjustments with that accepted
pose before replacing the build input:

```sh
npx tsx scripts/avatar/rebase-idle-pose.ts /path/to/new-download.json assets/avatar-sources/bradley-idle-pose.json
npm run build:avatar
```

The rebase command validates the download's model hash and rebuilds the current
accepted pose to prove it matches the model that was edited. It then combines the
rotation offsets in order while retaining untouched joints. A mismatch fails
before writing the output. The following build applies the combined pose once
against the original baseline.

## Implementation and proof

- `scripts/avatar/pose-studio.html`: local entry and controls.
- `scripts/avatar/pose-editor.ts`: Three.js viewer, pointer/keyboard interaction,
  history, playback, browser storage, and import/export.
- `lib/avatar/pose-editor.ts`: analytic two-bone inverse kinematics, isolated
  animation sampling, wrist/posture rotations, quaternion offsets, and draft
  validation.
- `lib/avatar/pose-editor.test.ts`: limb reach and length, bend direction, wrist
  orientation, independent wrist rotation/straightening, stable repeated animation
  sampling, head/shoulder rotation directions, and draft round trips.
- `app/globals.css`: token-based styles under `.portfolio-pose-editor`.

The editor uses the native pointer because its draggable handles and camera
controls are outside the portfolio's custom-cursor component. Bones receive
rotation offsets only; translations, lengths, scales, skin weights, and the bind
pose stay unchanged. Animation sampling uses a separate, unedited hierarchy:
resetting an animated bone externally can otherwise conflict with Three.js's
cached values and snap untouched limbs back to their rest pose.

Posture controls express rotations in the model's axes using the parent basis
from the original idle frame. The torso hierarchy is
`Hips > Spine02 > Spine01 > Spine > neck > Head`; `Spine` is the upper chest,
with both shoulders as children. Saved drafts remain version 1 and accept these
additional posture joints alongside existing limb offsets.

Browser verification should use one headless browser attached to the workspace
server, an ephemeral context, and the shared verification-slot contract. Exercise
actual drags, untouched limbs, keyboard moves, undo/redo, preview, save/reload,
export/import, invalid imports, and narrow viewports. Final feel remains a manual
walk; software-rendered WebGL checks do not prove device GPU fidelity.
For posture changes, also exercise each point, verify existing limb offsets stay
identical, and check that resetting posture preserves those offsets.
