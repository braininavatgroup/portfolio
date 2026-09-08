import {
  appendFloatAccessor,
  readFloatAccessor,
  type GlbAnimation,
  type ParsedGlb,
} from "./glb";

/**
 * Carries animation clips from one Meshy humanoid export onto another that
 * shares the same joint names. Rotations transfer relative to each rig's rest
 * pose (target rest * inverse(source rest) * source local) so a rig whose arms
 * rest at a different angle does not inherit the source's stance. Hips translation is
 * re-based on the target rest pose and scaled by the hip height ratio so the
 * clip's crouches and bobs keep their proportion. Every other translation and
 * every scale track is dropped so the target keeps its own bone lengths.
 */

function nodeIndexByName(glb: ParsedGlb) {
  return new Map(
    glb.json.nodes.map((node, index) => [node.name ?? "", index] as const),
  );
}

type Quaternion = readonly [number, number, number, number];

function multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function invertQuaternion([x, y, z, w]: Quaternion): Quaternion {
  return [-x, -y, -z, w];
}

function rotateVector(q: Quaternion, v: readonly [number, number, number]) {
  const [x, y, z, w] = q;
  const cross = (a: readonly number[], b: readonly number[]) => [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ];
  const u = [x, y, z];
  const uv = cross(u, v);
  const uuv = cross(u, uv);
  return [0, 1, 2].map((i) => v[i]! + 2 * (w * uv[i]! + uuv[i]!)) as [number, number, number];
}

function axisAngleQuaternion(axis: readonly [number, number, number], radians: number): Quaternion {
  const s = Math.sin(radians / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(radians / 2)];
}

/** World-space rest rotation of a node, composed down from the scene root. */
function restWorldRotation(glb: ParsedGlb, nodeIndex: number): Quaternion {
  const parent = glb.json.nodes.findIndex((node) => node.children?.includes(nodeIndex));
  const local = glb.json.nodes[nodeIndex]?.rotation ?? [0, 0, 0, 1];
  return parent === -1 ? local : multiplyQuaternions(restWorldRotation(glb, parent), local);
}

export type RetargetOptions = {
  /**
   * Radians to fold each upper arm in toward the body about the stage's
   * forward axis, applied at the shoulder joint. Meshy's conversational idles
   * hold the arms in a wide A; this relaxes them to hang beside the hips.
   */
  shoulderAdductionRadians?: number;
};

const upperArmNodes: ReadonlyArray<readonly [name: string, sign: 1 | -1]> = [
  ["LeftArm", -1],
  ["RightArm", 1],
];

/** Pre-multiplies every frame by a fixed rotation expressed in the parent joint's frame. */
export function adductAtShoulder(
  values: Float32Array,
  parentRestWorld: Quaternion,
  radians: number,
) {
  const axis = rotateVector(invertQuaternion(parentRestWorld), [0, 0, 1]);
  const fold = axisAngleQuaternion(axis, radians);
  const output = new Float32Array(values.length);
  for (let offset = 0; offset < values.length; offset += 4) {
    output.set(
      multiplyQuaternions(fold, [
        values[offset]!,
        values[offset + 1]!,
        values[offset + 2]!,
        values[offset + 3]!,
      ]),
      offset,
    );
  }
  return output;
}

/** Re-expresses every keyed rotation as the source's offset from its rest pose, applied to the target rest pose. */
export function retargetRotation(
  values: Float32Array,
  sourceRest: Quaternion,
  targetRest: Quaternion,
) {
  const correction = multiplyQuaternions(targetRest, invertQuaternion(sourceRest));
  const output = new Float32Array(values.length);
  for (let offset = 0; offset < values.length; offset += 4) {
    const rotated = multiplyQuaternions(correction, [
      values[offset]!,
      values[offset + 1]!,
      values[offset + 2]!,
      values[offset + 3]!,
    ]);
    output.set(rotated, offset);
  }
  return output;
}

export function retargetHipsTranslation(
  values: Float32Array,
  sourceRest: readonly [number, number, number],
  targetRest: readonly [number, number, number],
) {
  const ratio = sourceRest[1] === 0 ? 1 : targetRest[1] / sourceRest[1];
  const output = new Float32Array(values.length);
  for (let offset = 0; offset < values.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      output[offset + axis] =
        targetRest[axis]! + (values[offset + axis]! - sourceRest[axis]!) * ratio;
    }
  }
  return output;
}

/**
 * Relaxes a native clip with separate upper-arm and clavicle corrections.
 * Lowering the clavicles lets the shoulders settle without forcing the whole
 * correction through the upper-arm joints and pinching the sleeves.
 */
export function foldClipArms(
  glb: ParsedGlb,
  animation: GlbAnimation,
  radians: number,
  shoulderDropRadians = 0,
) {
  for (const channel of animation.channels) {
    if (channel.target.path !== "rotation") continue;
    const name = glb.json.nodes[channel.target.node]?.name ?? "";
    const upperArm = upperArmNodes.find(([armName]) => armName === name);
    const shoulderSign = name === "LeftShoulder" ? -1 : name === "RightShoulder" ? 1 : 0;
    const correction = upperArm ? radians * upperArm[1] : shoulderDropRadians * shoulderSign;
    if (!correction) continue;
    const parent = glb.json.nodes.findIndex((node) =>
      node.children?.includes(channel.target.node),
    );
    const sampler = animation.samplers[channel.sampler]!;
    sampler.output = appendFloatAccessor(
      glb,
      adductAtShoulder(
        readFloatAccessor(glb, sampler.output),
        restWorldRotation(glb, parent),
        correction,
      ),
      "VEC4",
    );
  }
}

export function retargetClip(
  target: ParsedGlb,
  source: ParsedGlb,
  animation: GlbAnimation,
  name = animation.name ?? "",
  options: RetargetOptions = {},
): GlbAnimation {
  const targetNodes = nodeIndexByName(target);
  const accessorCache = new Map<number, number>();
  const copyInput = (index: number) => {
    const cached = accessorCache.get(index);
    if (cached !== undefined) return cached;
    const copied = appendFloatAccessor(
      target,
      readFloatAccessor(source, index),
      "SCALAR",
      true,
    );
    accessorCache.set(index, copied);
    return copied;
  };
  const samplers: GlbAnimation["samplers"] = [];
  const channels: GlbAnimation["channels"] = [];

  for (const channel of animation.channels) {
    const sourceNode = source.json.nodes[channel.target.node];
    const sourceName = sourceNode?.name ?? "";
    const targetIndex = targetNodes.get(sourceName);
    if (targetIndex === undefined) {
      throw new Error(`Target rig has no node named ${sourceName} for clip ${name}`);
    }
    const sampler = animation.samplers[channel.sampler]!;
    let output: number;
    if (channel.target.path === "rotation") {
      let rotations = retargetRotation(
        readFloatAccessor(source, sampler.output),
        sourceNode?.rotation ?? [0, 0, 0, 1],
        target.json.nodes[targetIndex]?.rotation ?? [0, 0, 0, 1],
      );
      const upperArm = upperArmNodes.find(([armName]) => armName === sourceName);
      if (upperArm && options.shoulderAdductionRadians) {
        const parent = target.json.nodes.findIndex((node) =>
          node.children?.includes(targetIndex),
        );
        rotations = adductAtShoulder(
          rotations,
          restWorldRotation(target, parent),
          options.shoulderAdductionRadians * upperArm[1],
        );
      }
      output = appendFloatAccessor(target, rotations, "VEC4");
    } else if (channel.target.path === "translation" && sourceName === "Hips") {
      output = appendFloatAccessor(
        target,
        retargetHipsTranslation(
          readFloatAccessor(source, sampler.output),
          sourceNode?.translation ?? [0, 0, 0],
          target.json.nodes[targetIndex]?.translation ?? [0, 0, 0],
        ),
        "VEC3",
      );
    } else {
      continue;
    }
    const samplerIndex = samplers.push({
      input: copyInput(sampler.input),
      interpolation: sampler.interpolation ?? "LINEAR",
      output,
    }) - 1;
    channels.push({
      sampler: samplerIndex,
      target: { node: targetIndex, path: channel.target.path },
    });
  }

  return { channels, name, samplers };
}

export function retargetClips(
  target: ParsedGlb,
  source: ParsedGlb,
  clips: ReadonlyArray<readonly [name: string, options?: RetargetOptions]>,
) {
  const byName = new Map(
    (source.json.animations ?? []).map((animation) => [animation.name, animation] as const),
  );
  target.json.animations ??= [];
  for (const [clipName, options] of clips) {
    const animation = byName.get(clipName);
    if (!animation) throw new Error(`Missing source clip: ${clipName}`);
    target.json.animations.push(
      retargetClip(target, source, animation, clipName, options),
    );
  }
}
