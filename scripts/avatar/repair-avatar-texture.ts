import { createHash } from "node:crypto";
import { align4, parseGlb, writeGlb } from "./glb";

/** Apply a checked-in atlas repair after pose baking, without touching animation data. */
export function repairAvatarTexture(source: Buffer, uvBytes: Buffer, texture: Buffer, sourceUvSha256: string) {
  const glb = parseGlb(source);
  const primitives = glb.json.meshes.flatMap(mesh => mesh.primitives);
  if (primitives.length !== 1 || glb.json.images?.length !== 1) {
    throw new Error("Texture repair expects the portrait's one mesh and one image.");
  }
  const accessor = glb.json.accessors[primitives[0]!.attributes.TEXCOORD_0!];
  if (!accessor || accessor.type !== "VEC2" || accessor.componentType !== 5126 || accessor.bufferView === undefined) {
    throw new Error("Texture repair requires float UV coordinates.");
  }
  const view = glb.json.bufferViews[accessor.bufferView]!;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? 8;
  const original = Buffer.alloc(accessor.count * 8);
  for (let i = 0; i < accessor.count; i++) glb.binary.copy(original, i * 8, start + i * stride, start + i * stride + 8);
  if (createHash("sha256").update(original).digest("hex") !== sourceUvSha256) {
    throw new Error("Texture repair belongs to different UV coordinates. Regenerate it from the source model.");
  }
  if (uvBytes.length !== original.length) throw new Error("Replacement UV coordinates have the wrong length.");
  for (let i = 0; i < uvBytes.length; i += 4) {
    const value = uvBytes.readFloatLE(i);
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("Replacement UV coordinates must be finite and inside the atlas.");
  }
  for (let i = 0; i < accessor.count; i++) uvBytes.copy(glb.binary, start + i * stride, i * 8, i * 8 + 8);
  // Optional bounds describe the old atlas and must not survive its replacement.
  delete accessor.min;
  delete accessor.max;
  const offset = align4(glb.binary.length);
  glb.binary = Buffer.concat([glb.binary, Buffer.alloc(offset - glb.binary.length), texture]);
  const bufferView = glb.json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: texture.length }) - 1;
  glb.json.images[0] = { ...glb.json.images[0], bufferView, mimeType: "image/webp" };
  return writeGlb(glb);
}
