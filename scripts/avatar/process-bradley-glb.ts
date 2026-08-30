import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

type GlbAccessor = {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  normalized?: boolean;
  type: string;
};

type GlbJson = {
  accessors: GlbAccessor[];
  animations: Array<{
    channels?: Array<{ sampler: number; target: { node: number; path: "rotation" } }>;
    name?: string;
    samplers?: Array<{
      input: number;
      interpolation: "LINEAR";
      output: number;
    }>;
  }>;
  bufferViews: Array<{
    buffer: number;
    byteLength: number;
    byteOffset?: number;
    byteStride?: number;
    target?: number;
  }>;
  buffers: Array<{ byteLength: number }>;
  materials?: Array<Record<string, unknown>>;
  meshes: Array<{
    primitives: Array<{
      attributes: Record<string, number>;
      material?: number;
    }>;
  }>;
  nodes: Array<{ name?: string; rotation?: [number, number, number, number] }>;
  skins: Array<{ joints: number[] }>;
  [key: string]: unknown;
};

type ParsedGlb = {
  binary: Buffer;
  json: GlbJson;
};

const glbMagic = 0x46546c67;
const jsonChunkType = 0x4e4f534a;
const binaryChunkType = 0x004e4942;

const meshyAnimationNames = [
  "Idle_3",
  "Walking",
  "Wake_Up_and_Look_Up",
  "Agree_Gesture",
  "Wave_One_Hand",
  "Big_Wave_Hello",
  "Cheer_with_Both_Hands_1",
  "Shrug",
] as const;

export const bradleyAnimationNames = meshyAnimationNames;

const palette = {
  hair: [43, 35, 32, 255],
  jacket: [58, 73, 84, 255],
  pants: [39, 43, 49, 255],
  shirt: [145, 121, 93, 255],
  shoes: [27, 27, 29, 255],
  skin: [188, 126, 96, 255],
} as const;

export function resolveBradleyVertexColor(
  boneName: string,
  position: readonly [number, number, number],
) {
  if (/Foot|Toe/i.test(boneName)) return palette.shoes;
  if (/Leg/i.test(boneName)) return palette.pants;
  if (/Hand|neck/i.test(boneName)) return palette.skin;
  if (/Head/i.test(boneName)) {
    return position[1] >= 1.53 ? palette.hair : palette.skin;
  }
  if (/Hips/i.test(boneName) && position[1] < 0.95) return palette.pants;
  if (/Spine02/i.test(boneName) && position[2] < -0.08) return palette.shirt;
  return palette.jacket;
}

function align4(value: number) {
  return Math.ceil(value / 4) * 4;
}

function parseGlb(input: Buffer): ParsedGlb {
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

function writeGlb({ binary, json }: ParsedGlb) {
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

function accessorReader(json: GlbJson, binary: Buffer, accessorIndex: number) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const componentSizes: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
  const componentCounts: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const componentSize = componentSizes[accessor.componentType];
  const componentCount = componentCounts[accessor.type];
  if (!componentSize || !componentCount) throw new Error("Unsupported accessor layout");
  const stride = view.byteStride ?? componentSize * componentCount;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  return (index: number, component: number) => {
    const byteOffset = start + index * stride + component * componentSize;
    if (accessor.componentType === 5121) return binary.readUInt8(byteOffset);
    if (accessor.componentType === 5123) return binary.readUInt16LE(byteOffset);
    if (accessor.componentType === 5125) return binary.readUInt32LE(byteOffset);
    return binary.readFloatLE(byteOffset);
  };
}

export function readGlbJson(input: Buffer) {
  return parseGlb(input).json;
}

export function processBradleyGlb(input: Buffer) {
  const { binary, json } = parseGlb(input);
  const primitive = json.meshes[0]?.primitives[0];
  const skin = json.skins[0];
  if (!primitive || !skin) throw new Error("Expected one skinned Meshy character mesh");

  const positionAccessor = json.accessors[primitive.attributes.POSITION];
  const readPosition = accessorReader(json, binary, primitive.attributes.POSITION);
  const readJoint = accessorReader(json, binary, primitive.attributes.JOINTS_0);
  const readWeight = accessorReader(json, binary, primitive.attributes.WEIGHTS_0);
  const jointNames = skin.joints.map((nodeIndex) => json.nodes[nodeIndex]?.name ?? "");
  const vertexColors = Buffer.alloc(positionAccessor.count * 4);

  for (let index = 0; index < positionAccessor.count; index += 1) {
    let dominantComponent = 0;
    for (let component = 1; component < 4; component += 1) {
      if (readWeight(index, component) > readWeight(index, dominantComponent)) {
        dominantComponent = component;
      }
    }
    const boneName = jointNames[readJoint(index, dominantComponent)] ?? "";
    const position = [
      readPosition(index, 0),
      readPosition(index, 1),
      readPosition(index, 2),
    ] as const;
    const color = resolveBradleyVertexColor(boneName, position);
    vertexColors.set(color, index * 4);
  }

  const colorByteOffset = align4(binary.length);
  const expandedBinary = Buffer.alloc(colorByteOffset + vertexColors.length);
  binary.copy(expandedBinary);
  vertexColors.copy(expandedBinary, colorByteOffset);

  const colorBufferView = json.bufferViews.push({
    buffer: 0,
    byteLength: vertexColors.length,
    byteOffset: colorByteOffset,
    target: 34962,
  }) - 1;
  const colorAccessor = json.accessors.push({
    bufferView: colorBufferView,
    componentType: 5121,
    count: positionAccessor.count,
    normalized: true,
    type: "VEC4",
  }) - 1;
  const materialIndex = (json.materials ??= []).push({
    name: "Bradley PS1 vertex palette",
    pbrMetallicRoughness: {
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 0,
      roughnessFactor: 1,
    },
  }) - 1;

  primitive.attributes.COLOR_0 = colorAccessor;
  primitive.material = materialIndex;
  const animationsByName = new Map(json.animations.map((animation) => [animation.name, animation]));
  json.animations = meshyAnimationNames.map((name) => {
    const animation = animationsByName.get(name);
    if (!animation) throw new Error(`Missing required Meshy animation: ${name}`);
    return animation;
  });
  json.buffers[0].byteLength = expandedBinary.length;

  return writeGlb({ binary: expandedBinary, json });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    throw new Error("Usage: tsx process-bradley-glb.ts <input.glb> <output.glb>");
  }
  writeFileSync(
    outputPath,
    processBradleyGlb(readFileSync(inputPath)),
  );
}
