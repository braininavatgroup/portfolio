import { createHash } from "node:crypto";
import { Quaternion } from "three";
import { parsePoseDraft } from "../../lib/avatar/pose-editor";
import { appendFloatAccessor, parseGlb, readFloatAccessor, writeGlb } from "./glb";

/** Bake the editor's local rotation offsets into Idle on the exact authoring asset. */
export function applySavedIdlePose(source: Buffer, poseText: string) {
  const digest = createHash("sha256").update(source).digest("hex");
  const draft = parsePoseDraft(poseText, digest);
  const glb = parseGlb(source);
  const idle = glb.json.animations?.find(animation => animation.name === "Idle");
  if (!idle) throw new Error("Avatar has no Idle animation.");
  for (const [name, rotation] of Object.entries(draft.offsets)) {
    const node = glb.json.nodes.findIndex(node => node.name === name);
    const channel = idle.channels.find(channel => channel.target.node === node && channel.target.path === "rotation");
    if (!channel) throw new Error(`Missing idle rotation track for ${name}.`);
    const sampler = idle.samplers[channel.sampler]!;
    if (sampler.interpolation === "CUBICSPLINE") throw new Error(`Unsupported cubic idle rotation track for ${name}.`);
    const values = readFloatAccessor(glb, sampler.output);
    const offset = new Quaternion(...rotation);
    for (let index = 0; index < values.length; index += 4) {
      new Quaternion().fromArray(values, index).premultiply(offset).normalize().toArray(values, index);
    }
    // Deduplication may share accessors or samplers. Give this channel its own
    // data so editing Idle cannot change any other animation or rotation track.
    channel.sampler = idle.samplers.push({ ...sampler, output: appendFloatAccessor(glb, values, "VEC4") }) - 1;
  }
  return writeGlb(glb);
}
