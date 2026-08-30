import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bradleyAnimationNames,
  processBradleyGlb,
  readGlbJson,
} from "./process-bradley-glb";

describe("Bradley Meshy asset processing", () => {
  const source = readFileSync(
    resolve(process.cwd(), "assets/avatar-sources/bradley-meshy-rigged.glb"),
  );
  it("adds a body-region palette while preserving the humanoid skin", () => {
    // Catches a PS1 conversion that produces an unrigged or monochrome actor.
    const output = processBradleyGlb(source);
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
    const glb = readGlbJson(processBradleyGlb(source));

    expect(glb.animations.map((animation) => animation.name)).toEqual(
      bradleyAnimationNames,
    );
  });

});
