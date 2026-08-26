# Bradley Meshy avatar source

`bradley-meshy-rigged.glb` is the recoverable Meshy Pro export Bradley supplied on
2026-08-25. The file contains one 8,300-triangle humanoid skin and 20 animation
clips. Meshy exported no material or texture. Its SHA-256 is
`150f1f4c831ba633ef84e00a8b2e92836fcb4f48abade687bef8117f897b6fd2`.

`orange-justice-cc0.json` is the community-authored “Orange Justice” motion by
Good Deeds Josh from the archived
[Emotecraft emote collection at commit 3a0b644](https://github.com/KosmX/Emotecraft-emotes/blob/3a0b644eb896542dc6c2c8fe519bf5a9e00a8a5f/emotes/orange%20justice.json).
The collection is released under CC0 1.0. The normalized source SHA-256 is
`fd16c038786ca4721ed399b0f989a350880d14ba8654cc616ee78a1f373f6afc`.
No Fortnite game asset is included.

The production assets are rebuilt with one repository command:

```sh
npm run build:avatar
```

The command copies the supplied Meshy file byte-for-byte to
`public/avatars/bradley-meshy-rigged.glb`. The rendered actor uses that exact
file with Meshy's native animation clips, default material, continuous
playback, and no added glasses or mesh processing.

The same command builds `public/avatars/bradley-motion-library.glb` with the
locked `tsx` 4.23.12 and `@gltf-transform/cli` 4.4.2 toolchain. This separate
file preserves the selected Meshy clips and adds Orange Justice. The runtime
uses it only for animation clips missing from the untouched model, so its mesh
and vertex colors are never rendered. Its SHA-256 is
`7b4bf69cae4ff1fe156134dc11bcd4eae23feed6f3dab1469f8e02812891b1ef`.

Orange Justice preserves the authored eased head, torso, arm, and leg
rotations. Its block-model `x`/`y`/`z` offsets are omitted because applying
those absolute positions to the proportionally different Meshy skeleton would
dislocate its bones.

The original Quaternius and procedural actors remain in the repository as rollback
options.
