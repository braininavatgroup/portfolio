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
  assert.deepEqual(
    json.animations.map(({ name }) => name),
    [
      "Idle_3",
      "Walking",
      "Wake_Up_and_Look_Up",
      "Agree_Gesture",
      "Wave_One_Hand",
      "Big_Wave_Hello",
      "Cheer_with_Both_Hands_1",
      "Shrug",
    ],
    "built motion library contains only the selected Meshy clips",
  );
});

test("the production build contains no editor code or write route", async () => {
  const { readdir } = await import("node:fs/promises");
  const roots = ["dist/client", "dist/server"];
  const markers = [
    "__portfolio-editor",
    "data-editable-path",
    "portfolio-writing",
    'contentEditable: "plaintext-only"',
  ];

  for (const root of roots) {
    const entries = await readdir(new URL(`${root}/`, repositoryRoot), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/\.(js|mjs|cjs|css|html)$/.test(entry.name)) continue;
      const filePath = `${entry.parentPath}/${entry.name}`;
      const source = await readFile(filePath, "utf8");
      for (const marker of markers) {
        assert.ok(
          !source.includes(marker),
          `${filePath} leaks editor marker: ${marker}`,
        );
      }
    }
  }
});
