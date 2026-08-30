# Bradley Meshy avatar source

`bradley-meshy-rigged.glb` is the recoverable Meshy Pro export Bradley supplied on
2026-08-25. The file contains one 8,300-triangle humanoid skin and 20 animation
clips. Meshy exported no material or texture. Its SHA-256 is
`150f1f4c831ba633ef84e00a8b2e92836fcb4f48abade687bef8117f897b6fd2`.

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
file preserves the selected native Meshy clips. The runtime uses it only for
animation clips missing from the untouched model, so its mesh and vertex
colors are never rendered. Its SHA-256 is
`de9e75104321565da72926a8d407d165c7b2b4e7491de143f873ccb56814ceaa`.

The original Quaternius and procedural actors remain in the repository as rollback
options.
