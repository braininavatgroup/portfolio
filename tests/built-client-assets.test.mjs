import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const repositoryRoot = new URL("../", import.meta.url);

async function referencedClientAssets(manifestPath) {
  const source = await readFile(new URL(manifestPath, repositoryRoot), "utf8");
  return new Set(
    [...source.matchAll(/["']\/?(_next\/static\/(?:chunks|css)\/[^"']+)["']/g)].map(
      ([, pathname]) => pathname,
    ),
  );
}

test("every client asset referenced by the built server exists", async () => {
  const manifests = [
    "dist/server/__vite_rsc_assets_manifest.js",
    "dist/server/ssr/__vite_rsc_assets_manifest.js",
  ];

  for (const manifest of manifests) {
    const assets = await referencedClientAssets(manifest);
    assert.ok(assets.size > 0, `${manifest} references client assets`);

    for (const asset of assets) {
      await assert.doesNotReject(
        access(new URL(`dist/client/${asset}`, repositoryRoot)),
        `${manifest} references a missing client asset: ${asset}`,
      );
    }
  }
});

test("the production build copies the configured Bradley avatar byte-for-byte", async () => {
  const assetPaths = [
    "avatars/bradley-meshy-rigged.glb",
    "avatars/bradley-motion-library.glb",
  ];

  for (const assetPath of assetPaths) {
    const source = await readFile(new URL(`public/${assetPath}`, repositoryRoot));
    const built = await readFile(new URL(`dist/client/${assetPath}`, repositoryRoot));
    assert.deepEqual(built, source, `${assetPath} differs from its public source`);
  }

  const glb = await readFile(
    new URL("dist/client/avatars/bradley-motion-library.glb", repositoryRoot),
  );
  assert.equal(glb.readUInt32LE(0), 0x46546c67, "built avatar is a GLB");
  assert.equal(glb.readUInt32LE(4), 2, "built avatar uses glTF 2");

  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  assert.ok(
    json.animations.some(({ name }) => name === "Orange_Justice_CC0"),
    "built avatar includes the CC0 Orange Justice clip",
  );
});
