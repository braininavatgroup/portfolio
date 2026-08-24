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
