import { describe, expect, it } from "vitest";
import { appendFloatAccessor, parseGlb, readGlbJson, writeGlb, type ParsedGlb } from "./glb";
import { cleanMeshyClipName, mergeMeshyClips } from "./merge-meshy-clips";

function rig(nodeNames: string[], clipName: string | null) {
  const glb: ParsedGlb = {
    binary: Buffer.alloc(0),
    json: {
      accessors: [],
      animations: [],
      asset: { version: "2.0" },
      bufferViews: [],
      buffers: [],
      meshes: [],
      nodes: nodeNames.map((name) => ({ name })),
      scenes: [{ nodes: [0] }],
    },
  };
  if (clipName) {
    const input = appendFloatAccessor(glb, new Float32Array([0, 0.5, 1]), "SCALAR", true);
    const output = appendFloatAccessor(
      glb,
      new Float32Array([0, 0, 0, 1, 0, 0.7, 0, 0.7, 0, 0, 0, 1]),
      "VEC4",
    );
    glb.json.animations!.push({
      channels: [{ sampler: 0, target: { node: 1, path: "rotation" } }],
      name: clipName,
      samplers: [{ input, interpolation: "LINEAR", output }],
    });
  }
  return writeGlb(glb);
}

describe("Meshy clip merging", () => {
  it("strips the Armature|clip|baselayer wrapper from clip names", () => {
    expect(cleanMeshyClipName("Armature|Swim_Forward|baselayer")).toBe("Swim_Forward");
    expect(cleanMeshyClipName("Idle_3")).toBe("Idle_3");
  });

  it("folds every export's clip onto one character with keyframe bounds", () => {
    const merged = readGlbJson(
      mergeMeshyClips(rig(["Armature", "Hips"], "Armature|clip0|baselayer"), [
        rig(["Armature", "Hips"], "Armature|walking_man|baselayer"),
        rig(["Armature", "Hips"], "Armature|Swim_Idle|baselayer"),
      ]),
    );

    expect(merged.animations?.map((animation) => animation.name)).toEqual([
      "walking_man",
      "Swim_Idle",
    ]);
    for (const animation of merged.animations ?? []) {
      const input = merged.accessors[animation.samplers[0]!.input]!;
      expect(input.min).toEqual([0]);
      expect(input.max).toEqual([1]);
      expect(animation.channels[0]?.target).toEqual({ node: 1, path: "rotation" });
    }
    expect(parseGlb(mergeMeshyClips(rig(["Armature", "Hips"], null), [])).json.animations)
      .toEqual([]);
  });

  it("refuses a clip exported from a different node hierarchy", () => {
    expect(() =>
      mergeMeshyClips(rig(["Armature", "Hips"], null), [
        rig(["Armature", "Pelvis"], "Armature|walking_man|baselayer"),
      ]),
    ).toThrow(/Node hierarchy differs/);
  });
});
