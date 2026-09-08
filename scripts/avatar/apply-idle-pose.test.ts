import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applySavedIdlePose } from "./apply-idle-pose";
import { appendFloatAccessor, parseGlb, readFloatAccessor, writeGlb, type ParsedGlb } from "./glb";

function fixture() {
  const glb: ParsedGlb = { binary: Buffer.alloc(0), json: {
    nodes: [{ name: "Head" }], meshes: [], buffers: [], bufferViews: [], accessors: [],
  } };
  const input = appendFloatAccessor(glb, new Float32Array([0, 1]), "SCALAR", true);
  const output = appendFloatAccessor(glb, new Float32Array([0, 0, 0, 1, 0, Math.SQRT1_2, 0, Math.SQRT1_2]), "VEC4");
  glb.json.animations = ["Idle", "Walking"].map(name => ({ name,
    channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }],
    samplers: [{ input, output, interpolation: "LINEAR" }],
  }));
  const bytes = writeGlb(glb);
  const draft = { version: 1, clip: "Idle", sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    offsets: { Head: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] } };
  return { bytes, draft };
}

describe("saved idle pose baking", () => {
  it("premultiplies every idle keyframe without changing shared animation data or bind transforms", () => {
    const { bytes, draft } = fixture();
    const before = parseGlb(bytes);
    const after = parseGlb(applySavedIdlePose(bytes, JSON.stringify(draft)));
    const idle = after.json.animations![0]!;
    const values = readFloatAccessor(after, idle.samplers[idle.channels[0]!.sampler]!.output);
    [Math.SQRT1_2, 0, 0, Math.SQRT1_2, 0.5, 0.5, 0.5, 0.5].forEach((value, i) => expect(values[i]).toBeCloseTo(value, 6));
    expect(after.json.nodes).toEqual(before.json.nodes);
    expect(after.json.animations![1]).toEqual(before.json.animations![1]);
    expect(readFloatAccessor(after, after.json.animations![1]!.samplers[0]!.output))
      .toEqual(readFloatAccessor(before, before.json.animations![1]!.samplers[0]!.output));
  });

  it("rejects a different source or a second application", () => {
    const { bytes, draft } = fixture();
    expect(() => applySavedIdlePose(bytes, JSON.stringify({ ...draft, sourceSha256: "0".repeat(64) }))).toThrow(/different avatar/);
    const baked = applySavedIdlePose(bytes, JSON.stringify(draft));
    expect(() => applySavedIdlePose(baked, JSON.stringify(draft))).toThrow(/different avatar/);
  });

  it("rejects missing rotation tracks instead of silently dropping edits", () => {
    const { bytes, draft } = fixture();
    expect(() => applySavedIdlePose(bytes, JSON.stringify({ ...draft, offsets: { neck: [0, 0, 0, 1] } })))
      .toThrow(/rotation track.*neck/);
  });
});
