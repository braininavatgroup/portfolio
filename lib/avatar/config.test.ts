import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { avatarAsset } from "./config";
import { avatarClips, avatarDanceDurationsMs, avatarDances, SWIM_DOCKING_MS, FULL_TURN_MS, WAVE_MS } from "./runtime";

function readGlbJson(pathname: string) {
  const file = readFileSync(pathname);

  expect(file.readUInt32LE(0)).toBe(0x46546c67);
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(16)).toBe(0x4e4f534a);

  const jsonLength = file.readUInt32LE(12);
  return JSON.parse(file.subarray(20, 20 + jsonLength).toString("utf8"));
}

describe("production avatar asset", () => {
  it("selects the Bradley portrait instead of either rollback character", () => {
    // Catches production silently reverting to the stock or handmade actor.
    expect(avatarAsset.modelUrl).toBe("/avatars/bradley-quiet-portrait.glb");
    expect(avatarAsset.forwardAxis).toBe("z");
    expect(avatarAsset.scale).toBeGreaterThanOrEqual(0.5);
    expect(avatarAsset.scale).toBeLessThanOrEqual(2);
    expect(avatarAsset.playbackRate).toBe(1);
  });

  it("ships a textured, skinned portrait that fits the two-unit stage", () => {
    const glb = readGlbJson(
      resolve(process.cwd(), "public/avatars/bradley-quiet-portrait.glb"),
    );

    expect(glb.skins?.length).toBeGreaterThan(0);
    expect(glb.images?.length).toBe(1);
    expect(glb.images[0].mimeType).toBe("image/webp");
    expect(glb.materials?.length).toBe(1);
    // The Meshy export doubles its base color as a full-strength emissive so
    // its viewer looks unlit; the stage keeps a fraction so lights still shape
    // the figure without it going muddy.
    expect(glb.materials[0].emissiveTexture).toBeDefined();
    expect(glb.materials[0].emissiveFactor[0]).toBeGreaterThan(0.3);
    expect(glb.materials[0].emissiveFactor[0]).toBeLessThan(0.8);

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

  it("ships every registered clip in the one model file", () => {
    // Catches a first-class behavior whose exact animation is absent at runtime.
    const model = readGlbJson(
      resolve(process.cwd(), "public/avatars/bradley-quiet-portrait.glb"),
    );
    const shippedNames = new Set<string>(
      (model.animations ?? [])
        .map((animation: { name?: string }) => animation.name)
        .filter((name: string | undefined): name is string => Boolean(name)),
    );

    for (const clipName of Object.values(avatarClips)) {
      expect(shippedNames.has(clipName), `${clipName} is shipped`).toBe(true);
    }
  });

  it("lets docking and full turns finish their shipped clips", () => {
    const model = readGlbJson(resolve(process.cwd(), "public/avatars/bradley-quiet-portrait.glb"));
    for (const [name, duration] of [["Wave_One_Hand", WAVE_MS], ["swimming_to_edge", SWIM_DOCKING_MS], ["Full_Turn_Left", FULL_TURN_MS]] as const) {
      const animation = model.animations.find((clip: { name: string }) => clip.name === name);
      const seconds = Math.max(...animation.samplers.map((sampler: { input: number }) => model.accessors[sampler.input].max[0]));
      expect(duration / 1000).toBeCloseTo(seconds, 2);
    }
  });

  it("pins each dance's runtime length to the shipped clip", () => {
    // Catches a re-export changing a routine's length while the runtime keeps
    // cutting to idle at the old time.
    const model = readGlbJson(
      resolve(process.cwd(), "public/avatars/bradley-quiet-portrait.glb"),
    );
    for (const dance of avatarDances) {
      const animation = model.animations.find(
        (candidate: { name: string }) => candidate.name === avatarClips[dance],
      );
      const seconds = Math.max(
        ...animation.samplers.map(
          (sampler: { input: number }) => model.accessors[sampler.input].max[0],
        ),
      );
      expect(avatarDanceDurationsMs[dance] / 1_000).toBeCloseTo(seconds, 1);
    }
  });
});
