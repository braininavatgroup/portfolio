# Bradley Meshy avatar sources

`bradley-quiet-portrait.glb` is the textured Meshy "Quiet Portrait" biped
Bradley supplied on 2026-09-08, with every animation Meshy exported for it
folded onto the one character. Meshy downloads one GLB per animation, each
carrying a full copy of the character and its 4 MB texture, so the folders are
merged into this single recoverable source with:

```sh
npx tsx scripts/avatar/merge-meshy-clips.ts \
  assets/avatar-sources/bradley-quiet-portrait.glb \
  ~/Downloads/Meshy_AI_Quiet_Portrait_biped \
  ~/Downloads/Meshy_AI_Quiet_Portrait_biped-3 \
  ~/Downloads/Meshy_AI_Quiet_Portrait_biped-4
```

The first folder must contain `*_Character_output.glb`; later folders add or
replace clips by name. Clip names lose Meshy's `Armature|…|baselayer` wrapper.

`bradley-meshy-rigged.glb` is the earlier untextured Meshy Pro export from
2026-08-25. It shares the portrait's 24-joint rig and is kept for its
conversational `Agree_Gesture` and dedicated `Wave_One_Hand` greeting, which
the portrait was never exported with.

The production asset is rebuilt with one repository command:

```sh
npm run build:avatar
```

It writes `public/avatars/bradley-quiet-portrait.glb` with the locked `tsx`
4.23.12 and `@gltf-transform/cli` 4.4.2 toolchain: the portrait's clips are
renamed to their shipped names, the agree gesture is retargeted rest-relative
onto the portrait rig with the arms folded in from Meshy's wide A, the
base-color-as-emissive trick is kept at 0.6 so the stage lights still shape the
figure, the texture is resized to 1024px WebP, and the clips are resampled and
pruned. The build is deterministic; the test rebuilds it byte-for-byte.

The portrait was supplied in a T-pose. Its native `Idle_11` becomes `Idle`.
The baseline build applies `portraitArmRelaxation`, then the accepted manual
pose in `bradley-idle-pose.json`, copied from Bradley's
`bradley-idle-pose-4.json` download on 2026-09-08. This includes his final limb,
wrist, shoulder, neck, and pelvis adjustments.

The pose is baked after asset optimization and validates the exact baseline
SHA-256 before applying any offsets. Each edited Idle rotation channel gets
its own keyframe data so shared accessors cannot affect other animations.
The wave is retargeted and appended after this hash-validated pose bake, so
adding a gesture does not change the accepted baseline or any existing clip.
The bind pose, skin weights, textures, and other clips stay unchanged. Rebuilds
start from the original sources, so the manual offsets are applied once.

The original Quaternius actor remains in the repository as a rollback option.

To pose the limbs manually in the browser, use the [local avatar pose editor](../../docs/avatar-pose-editor.md). It saves draft offsets separately from these source assets.

## Texture seam repair

The portrait's original atlas has 1,204 UV patches. Minified texture sampling
blended neighboring patches into pale lines on the jeans, arms, and shirt.
The accepted repair repacks those patches into a 4096px atlas with 16px gutters,
extends clean interior colors into the gutters, and stores it as lossless WebP.
Smooth mipmap filtering stays enabled.

The checked-in `bradley-texture-repair.webp`, `bradley-texture-repair-uv.bin`,
and `bradley-texture-repair.json` contain the repaired texture, UV coordinates,
and source hashes. `npm run build:avatar` applies them after the accepted idle
pose is baked. The build verifies the source model and original UV hashes.
It changes only texture coordinates and the embedded image, retaining geometry,
skin weights, materials, the saved pose, and every animation track.
Normal builds require only the existing Node toolchain.

To regenerate the repair from the original source:

```sh
python3 -m venv .context/avatar-texture-tools
.context/avatar-texture-tools/bin/pip install -r scripts/avatar/texture-repair-requirements.txt
.context/avatar-texture-tools/bin/python -B scripts/avatar/repack_avatar_texture.py
.context/avatar-texture-tools/bin/python -B -m unittest discover -s scripts/avatar -p '*_test.py'
npm run build:avatar
```

The higher-resolution atlas increases the download by about 3 MB and uses more
GPU texture memory. Its purpose is to preserve texture detail while giving
patches room for filtering; disabling mipmaps alone removed seams but produced
visible graininess. Browser verification compares the avatar at editor and
portfolio sizes. Extreme minification and physical-device motion remain visual
review cases.
