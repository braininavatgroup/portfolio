import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { avatarAsset } from "./config";
import { avatarClips } from "./runtime";

function sha256(file: Buffer) {
  return createHash("sha256").update(file).digest("hex");
}

function readGlbJson(pathname: string) {
  const file = readFileSync(pathname);

  expect(file.readUInt32LE(0)).toBe(0x46546c67);
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(16)).toBe(0x4e4f534a);

  const jsonLength = file.readUInt32LE(12);
  return JSON.parse(file.subarray(20, 20 + jsonLength).toString("utf8"));
}

describe("production avatar asset", () => {
  it("selects the Bradley actor instead of either rollback character", () => {
    // Catches production silently reverting to the stock or handmade actor.
    expect(avatarAsset.modelUrl).toBe("/avatars/bradley-meshy-rigged.glb");
    expect(avatarAsset.motionUrl).toBe("/avatars/bradley-motion-library.glb");
    expect(avatarAsset.forwardAxis).toBe("z");
    expect(avatarAsset.scale).toBeGreaterThanOrEqual(0.5);
    expect(avatarAsset.scale).toBeLessThanOrEqual(2);
    expect(avatarAsset.playbackRate).toBe(1);
  });

  it("ships the exact Meshy GLB as the rendered model", () => {
    const source = readFileSync(
      resolve(process.cwd(), "assets/avatar-sources/bradley-meshy-rigged.glb"),
    );
    const production = readFileSync(
      resolve(process.cwd(), "public/avatars/bradley-meshy-rigged.glb"),
    );
    expect(production.byteLength).toBe(source.byteLength);
    expect(sha256(production)).toBe(sha256(source));

    const glb = readGlbJson(
      resolve(process.cwd(), "public/avatars/bradley-meshy-rigged.glb"),
    );

    expect(glb.skins?.length).toBeGreaterThan(0);
    expect(glb.animations?.length).toBeGreaterThan(0);

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

    expect(minimumY * avatarAsset.scale + avatarAsset.groundOffset)
      .toBeGreaterThanOrEqual(-1);
    expect(maximumY * avatarAsset.scale + avatarAsset.groundOffset)
      .toBeLessThanOrEqual(1);
  });

  it("ships every registered clip across the exact model and motion library", () => {
    // Catches a first-class behavior whose exact animation is absent at runtime.
    const model = readGlbJson(
      resolve(process.cwd(), "public/avatars/bradley-meshy-rigged.glb"),
    );
    const motion = readGlbJson(
      resolve(process.cwd(), "public/avatars/bradley-motion-library.glb"),
    );
    const shippedNames = new Set<string>(
      [...(model.animations ?? []), ...(motion.animations ?? [])]
        .map((animation: { name?: string }) => animation.name)
        .filter((name: string | undefined): name is string => Boolean(name)),
    );

    expect(Object.values(avatarClips).map((clipName) => shippedNames.has(clipName)))
      .toEqual([true, true, true, true]);
  });
});
