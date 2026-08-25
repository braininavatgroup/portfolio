import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { avatarAsset } from "./config";

function readGlbJson(pathname: string) {
  const file = readFileSync(pathname);

  expect(file.readUInt32LE(0)).toBe(0x46546c67);
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(16)).toBe(0x4e4f534a);

  const jsonLength = file.readUInt32LE(12);
  return JSON.parse(file.subarray(20, 20 + jsonLength).toString("utf8"));
}

describe("production avatar asset", () => {
  it("selects the shipped game character instead of the procedural fallback", () => {
    // Catches production silently reverting to the handmade capsule actor.
    expect(avatarAsset.kind).toBe("gltf");
    expect(avatarAsset.modelUrl).toBe("/avatars/quaternius-casual-2.glb");
  });

  it("maps assistant behaviors only to non-combat source clips", () => {
    // Catches a pointing, confused, or success state that reads as violence or weapon use.
    for (const clipName of Object.values(avatarAsset.animations)) {
      expect(clipName).not.toMatch(/death|gun|hit|kick|punch|shoot|sword/i);
    }
  });

  it("ships a skinned GLB containing every configured animation clip", () => {
    // Catches a missing, malformed, unrigged, or clip-incompatible replacement asset.
    const glb = readGlbJson(
      resolve(process.cwd(), "public/avatars/quaternius-casual-2.glb"),
    );
    const clipNames = new Set<string>(
      (glb.animations ?? []).map((animation: { name?: string }) => animation.name),
    );

    expect(glb.skins?.length).toBeGreaterThan(0);
    for (const clipName of Object.values(avatarAsset.animations)) {
      expect(clipNames).toContain(clipName);
    }

    const positionAccessors = glb.meshes.flatMap(
      (mesh: { primitives: Array<{ attributes: { POSITION: number } }> }) =>
        mesh.primitives.map((primitive) =>
          glb.accessors[primitive.attributes.POSITION],
        ),
    );
    const minimumY = Math.min(
      ...positionAccessors.map((accessor: { min: number[] }) => accessor.min[1]),
    );
    const maximumY = Math.max(
      ...positionAccessors.map((accessor: { max: number[] }) => accessor.max[1]),
    );

    expect(minimumY + avatarAsset.groundOffset).toBeGreaterThanOrEqual(-1);
    expect(maximumY + avatarAsset.groundOffset).toBeLessThanOrEqual(1);
  });
});
