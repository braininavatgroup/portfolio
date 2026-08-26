import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bradleyAnimationNames,
  processBradleyGlb,
  readGlbJson,
  sampleOrangeJusticeRotation,
} from "./process-bradley-glb";

describe("Bradley Meshy asset processing", () => {
  const source = readFileSync(
    resolve(process.cwd(), "assets/avatar-sources/bradley-meshy-rigged.glb"),
  );
  const orangeJustice = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "assets/avatar-sources/orange-justice-cc0.json"),
      "utf8",
    ),
  );

  it("adds a body-region palette while preserving the humanoid skin", () => {
    // Catches a PS1 conversion that produces an unrigged or monochrome actor.
    const output = processBradleyGlb(source, orangeJustice);
    const glb = readGlbJson(output);
    const primitive = glb.meshes[0].primitives[0];

    expect(glb.skins).toHaveLength(1);
    expect(glb.materials).toEqual([
      expect.objectContaining({
        name: "Bradley PS1 vertex palette",
        pbrMetallicRoughness: expect.objectContaining({
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        }),
      }),
    ]);
    expect(primitive.material).toBe(0);
    expect(primitive.attributes.COLOR_0).toEqual(expect.any(Number));

    const colorAccessor = glb.accessors[primitive.attributes.COLOR_0];
    expect(colorAccessor).toMatchObject({
      componentType: 5121,
      normalized: true,
      type: "VEC4",
    });
  });

  it("keeps only the clips used by the portfolio behavior vocabulary", () => {
    // Catches an export that ships 20 costly clips while omitting an actual state clip.
    const glb = readGlbJson(processBradleyGlb(source, orangeJustice));

    expect(glb.animations.map((animation) => animation.name)).toEqual(
      bradleyAnimationNames,
    );
  });

  it("retargets the CC0 Orange Justice motion onto the Meshy humanoid rig", () => {
    // Catches a named placeholder that ships without usable body animation tracks.
    const glb = readGlbJson(processBradleyGlb(source, orangeJustice));
    const animation = glb.animations.find(
      (candidate: { name?: string }) => candidate.name === "Orange_Justice_CC0",
    );
    if (!animation?.channels || !animation.samplers) {
      throw new Error("Orange Justice animation is missing its retargeted tracks");
    }
    const targetNames = new Set(
      animation.channels.map(
        (channel: { target: { node: number } }) => glb.nodes[channel.target.node].name,
      ),
    );

    expect(targetNames).toEqual(
      new Set(["Head", "Spine01", "LeftArm", "RightArm", "LeftUpLeg", "RightUpLeg"]),
    );
    expect(animation.channels).toHaveLength(6);
    expect(animation.samplers).toHaveLength(6);

    const leftArmSamples = Array.from({ length: 141 }, (_, tick) =>
      sampleOrangeJusticeRotation(orangeJustice, "leftArm", tick),
    );
    const pitchRange = Math.max(...leftArmSamples.map(([pitch]) => pitch)) -
      Math.min(...leftArmSamples.map(([pitch]) => pitch));
    const rollRange = Math.max(...leftArmSamples.map(([, , roll]) => roll)) -
      Math.min(...leftArmSamples.map(([, , roll]) => roll));
    expect(pitchRange).toBeGreaterThan(2.5);
    expect(rollRange).toBeGreaterThan(5);

    const startYaw = sampleOrangeJusticeRotation(orangeJustice, "head", 5)[1];
    const nextYaw = sampleOrangeJusticeRotation(orangeJustice, "head", 10)[1];
    const easedYaw = sampleOrangeJusticeRotation(orangeJustice, "head", 6)[1];
    expect(easedYaw).toBeCloseTo(startYaw + (nextYaw - startYaw) * 0.08, 6);
    expect(
      readFileSync(
        resolve(
          process.cwd(),
          "assets/avatar-sources/orange-justice-CC0-LICENSE.txt",
        ),
        "utf8",
      ),
    ).toContain("CC0 1.0 Universal");
  });
});
