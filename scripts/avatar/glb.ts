/**
 * Minimal glTF 2.0 binary (GLB) reader and writer for the avatar build.
 *
 * Only the pieces the avatar pipeline touches are typed. Everything else in the
 * JSON chunk is carried through untouched.
 */

export type GlbAccessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  max?: number[];
  min?: number[];
  normalized?: boolean;
  type: string;
};

export type GlbBufferView = {
  buffer: number;
  byteLength: number;
  byteOffset?: number;
  byteStride?: number;
  target?: number;
};

export type GlbAnimationChannel = {
  sampler: number;
  target: { node: number; path: "translation" | "rotation" | "scale" | "weights" };
};

export type GlbAnimationSampler = {
  input: number;
  interpolation?: "LINEAR" | "STEP" | "CUBICSPLINE";
  output: number;
};

export type GlbAnimation = {
  channels: GlbAnimationChannel[];
  name?: string;
  samplers: GlbAnimationSampler[];
};

export type GlbNode = {
  children?: number[];
  name?: string;
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  translation?: [number, number, number];
};

export type GlbJson = {
  accessors: GlbAccessor[];
  animations?: GlbAnimation[];
  bufferViews: GlbBufferView[];
  buffers: Array<{ byteLength: number }>;
  images?: Array<{ bufferView?: number; mimeType?: string; name?: string }>;
  materials?: Array<Record<string, unknown>>;
  meshes: Array<{
    primitives: Array<{ attributes: Record<string, number>; material?: number }>;
  }>;
  nodes: GlbNode[];
  skins?: Array<{ joints: number[] }>;
  [key: string]: unknown;
};

export type ParsedGlb = {
  binary: Buffer;
  json: GlbJson;
};

const glbMagic = 0x46546c67;
const jsonChunkType = 0x4e4f534a;
const binaryChunkType = 0x004e4942;

export const componentSizes: Record<number, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};

export const componentCounts: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
};

export function align4(value: number) {
  return Math.ceil(value / 4) * 4;
}

export function parseGlb(input: Buffer): ParsedGlb {
  if (input.readUInt32LE(0) !== glbMagic || input.readUInt32LE(4) !== 2) {
    throw new Error("Expected a glTF 2.0 binary file");
  }

  let json: GlbJson | undefined;
  let binary: Buffer | undefined;
  let offset = 12;
  while (offset < input.length) {
    const length = input.readUInt32LE(offset);
    const type = input.readUInt32LE(offset + 4);
    const chunk = input.subarray(offset + 8, offset + 8 + length);
    if (type === jsonChunkType) {
      json = JSON.parse(chunk.toString("utf8").replace(/[\0 ]+$/, ""));
    } else if (type === binaryChunkType) {
      binary = Buffer.from(chunk);
    }
    offset += 8 + length;
  }

  if (!json || !binary) throw new Error("GLB must contain JSON and binary chunks");
  return { binary, json };
}

export function readGlbJson(input: Buffer) {
  return parseGlb(input).json;
}

export function writeGlb({ binary, json }: ParsedGlb) {
  json.buffers = [{ byteLength: binary.length }];
  const jsonSource = Buffer.from(JSON.stringify(json), "utf8");
  const jsonLength = align4(jsonSource.length);
  const binaryLength = align4(binary.length);
  const output = Buffer.alloc(12 + 8 + jsonLength + 8 + binaryLength, 0);

  output.writeUInt32LE(glbMagic, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonLength, 12);
  output.writeUInt32LE(jsonChunkType, 16);
  output.fill(0x20, 20, 20 + jsonLength);
  jsonSource.copy(output, 20);

  const binaryHeader = 20 + jsonLength;
  output.writeUInt32LE(binaryLength, binaryHeader);
  output.writeUInt32LE(binaryChunkType, binaryHeader + 4);
  binary.copy(output, binaryHeader + 8);
  return output;
}

export function accessorByteLength(accessor: GlbAccessor) {
  const componentSize = componentSizes[accessor.componentType];
  const componentCount = componentCounts[accessor.type];
  if (!componentSize || !componentCount) {
    throw new Error(`Unsupported accessor layout ${accessor.type}/${accessor.componentType}`);
  }
  return componentSize * componentCount * accessor.count;
}

/** Reads a tightly packed accessor as a Float32Array copy. */
export function readFloatAccessor(glb: ParsedGlb, accessorIndex: number) {
  const accessor = glb.json.accessors[accessorIndex];
  if (!accessor || accessor.componentType !== 5126 || accessor.bufferView === undefined) {
    throw new Error(`Accessor ${accessorIndex} is not a float buffer accessor`);
  }
  const view = glb.json.bufferViews[accessor.bufferView]!;
  if (view.byteStride) throw new Error("Interleaved accessors are not supported");
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const length = accessorByteLength(accessor);
  const copy = Buffer.alloc(length);
  glb.binary.copy(copy, 0, start, start + length);
  return new Float32Array(copy.buffer, copy.byteOffset, length / 4);
}

/**
 * Appends float data as a new tightly packed buffer view + accessor. Returns
 * the new accessor index. The binary chunk grows in place on `glb`. Animation
 * sampler inputs must carry bounds, so callers ask for them explicitly.
 */
export function appendFloatAccessor(
  glb: ParsedGlb,
  values: Float32Array,
  type: string,
  withBounds = false,
) {
  const componentCount = componentCounts[type];
  if (!componentCount || values.length % componentCount !== 0) {
    throw new Error(`Float data does not fit accessor type ${type}`);
  }
  const data = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
  const byteOffset = align4(glb.binary.length);
  const expanded = Buffer.alloc(byteOffset + data.length);
  glb.binary.copy(expanded);
  data.copy(expanded, byteOffset);
  glb.binary = expanded;

  const bufferView = glb.json.bufferViews.push({
    buffer: 0,
    byteLength: data.length,
    byteOffset,
  }) - 1;
  const accessor: GlbAccessor = {
    bufferView,
    componentType: 5126,
    count: values.length / componentCount,
    type,
  };
  if (withBounds) {
    const min = new Array<number>(componentCount).fill(Number.POSITIVE_INFINITY);
    const max = new Array<number>(componentCount).fill(Number.NEGATIVE_INFINITY);
    for (let index = 0; index < values.length; index += 1) {
      const component = index % componentCount;
      min[component] = Math.min(min[component]!, values[index]!);
      max[component] = Math.max(max[component]!, values[index]!);
    }
    accessor.min = min;
    accessor.max = max;
  }
  return glb.json.accessors.push(accessor) - 1;
}

export function jointNames(json: GlbJson) {
  return (json.skins?.[0]?.joints ?? []).map((index) => json.nodes[index]?.name ?? "");
}
