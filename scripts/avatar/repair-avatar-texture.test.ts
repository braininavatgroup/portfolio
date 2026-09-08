import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { repairAvatarTexture } from "./repair-avatar-texture";
import { parseGlb, writeGlb, type ParsedGlb } from "./glb";

function fixture() {
  // Position and UV share a strided buffer, as in gltf-transform's output.
  const vertices = new Float32Array([10, 20, 30, 0, 0, 40, 50, 60, 1, 1]);
  const originalUvs = Buffer.from(new Float32Array([0, 0, 1, 1]).buffer);
  const data: ParsedGlb = { binary: Buffer.from(vertices.buffer), json: {
    nodes: [{ name: "Hips" }], animations: [], buffers: [],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 40, byteStride: 20 }],
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: 2, type: "VEC3" },
      { bufferView: 0, byteOffset: 12, componentType: 5126, count: 2, type: "VEC2" },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 } }] }],
    images: [{ bufferView: 0, mimeType: "image/webp" }],
  } };
  return { source: writeGlb(data), sourceUvSha256: createHash("sha256").update(originalUvs).digest("hex") };
}

describe("avatar texture repair", () => {
  it("replaces strided UVs and the embedded texture while preserving every position and animation", () => {
    const { source, sourceUvSha256 } = fixture();
    const uv = Buffer.from(new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer);
    const texture = Buffer.from("lossless texture bytes");
    const result = parseGlb(repairAvatarTexture(source, uv, texture, sourceUvSha256));
    for (const [offset, value] of [[0,10],[4,20],[8,30],[20,40],[24,50],[28,60]]) {
      expect(result.binary.readFloatLE(offset!)).toBe(value);
    }
    for (const [offset,value] of [[12,.1],[16,.2],[32,.3],[36,.4]]) expect(result.binary.readFloatLE(offset!)).toBeCloseTo(value!,6);
    const view = result.json.bufferViews[result.json.images![0]!.bufferView!]!;
    expect(result.binary.subarray(view.byteOffset, view.byteOffset! + view.byteLength)).toEqual(texture);
    expect(result.json.nodes).toEqual(parseGlb(source).json.nodes);
    expect(result.json.animations).toEqual(parseGlb(source).json.animations);
  });

  it("rejects UV coordinates from a different mesh or a repeated repair", () => {
    const { source, sourceUvSha256 } = fixture();
    const uv=Buffer.from(new Float32Array([.1,.2,.3,.4]).buffer);
    expect(() => repairAvatarTexture(source, uv, Buffer.alloc(4), "0".repeat(64))).toThrow(/different UV/);
    const repaired=repairAvatarTexture(source,uv,Buffer.alloc(4),sourceUvSha256);
    expect(() => repairAvatarTexture(repaired,uv,Buffer.alloc(4),sourceUvSha256)).toThrow(/different UV/);
  });

  it("rejects incomplete or invalid replacement coordinates", () => {
    const { source, sourceUvSha256 }=fixture();
    for(const values of [[0,0],[0,0,NaN,1],[0,0,2,1]]) {
      expect(() => repairAvatarTexture(source,Buffer.from(new Float32Array(values).buffer),Buffer.alloc(4),sourceUvSha256)).toThrow(/coordinates/);
    }
  });
});
