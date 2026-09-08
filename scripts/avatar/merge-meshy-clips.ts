import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  appendFloatAccessor,
  parseGlb,
  readFloatAccessor,
  writeGlb,
  type GlbAnimation,
  type ParsedGlb,
} from "./glb";

/**
 * Meshy exports one GLB per animation, each carrying a full copy of the
 * character. This folds the animation clips of every `*_Animation_*` file onto
 * the `*_Character_output.glb` character so the repository keeps one source.
 */

export function cleanMeshyClipName(name: string) {
  // "Armature|Swim_Forward|baselayer" -> "Swim_Forward"
  const parts = name.split("|");
  return parts.length >= 3 ? parts[1]! : name;
}

export function copyAnimation(
  target: ParsedGlb,
  source: ParsedGlb,
  animation: GlbAnimation,
  name: string,
): GlbAnimation {
  const sourceNames = source.json.nodes.map((node) => node.name);
  const targetNames = target.json.nodes.map((node) => node.name);
  if (JSON.stringify(sourceNames) !== JSON.stringify(targetNames)) {
    throw new Error(`Node hierarchy differs for clip ${name}; cannot merge`);
  }
  const accessorCache = new Map<number, number>();
  const copyAccessor = (index: number, type: string, withBounds = false) => {
    const cached = accessorCache.get(index);
    if (cached !== undefined) return cached;
    const copied = appendFloatAccessor(
      target,
      readFloatAccessor(source, index),
      type,
      withBounds,
    );
    accessorCache.set(index, copied);
    return copied;
  };
  const samplers = animation.samplers.map((sampler) => {
    const outputType = source.json.accessors[sampler.output]!.type;
    return {
      input: copyAccessor(sampler.input, "SCALAR", true),
      interpolation: sampler.interpolation ?? "LINEAR",
      output: copyAccessor(sampler.output, outputType),
    };
  });
  return {
    channels: animation.channels.map((channel) => ({
      sampler: channel.sampler,
      target: { node: channel.target.node, path: channel.target.path },
    })),
    name,
    samplers,
  };
}

export function mergeMeshyClips(
  character: Buffer,
  clips: readonly Buffer[],
) {
  const target = parseGlb(character);
  target.json.animations = [];
  for (const file of clips) {
    const source = parseGlb(file);
    for (const animation of source.json.animations ?? []) {
      const name = cleanMeshyClipName(animation.name ?? "");
      target.json.animations.push(copyAnimation(target, source, animation, name));
    }
  }
  return writeGlb(target);
}

/**
 * Meshy re-downloads ship as sibling folders that may repeat clips. The first
 * folder must hold the character; later folders add or replace clips by name.
 */
export function mergeMeshyExportDirectories(directories: readonly string[]) {
  const files = directories.flatMap((directory) =>
    readdirSync(directory)
      .filter((file) => file.endsWith(".glb"))
      .sort()
      .map((file) => join(directory, file)),
  );
  const characterFile = files.find((file) => file.endsWith("_Character_output.glb"));
  if (!characterFile) throw new Error("No *_Character_output.glb in the export folders");
  const clipFiles = new Map<string, string>();
  for (const file of files) {
    const match = /_Animation_(.+)_withSkin\.glb$/.exec(file);
    if (match) clipFiles.set(match[1]!, file);
  }
  return mergeMeshyClips(
    readFileSync(characterFile),
    [...clipFiles.values()].map((file) => readFileSync(file)),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , outputPath, ...inputDirectories] = process.argv;
  if (!outputPath || inputDirectories.length === 0) {
    throw new Error(
      "Usage: tsx merge-meshy-clips.ts <output.glb> <meshy-export-directory>...",
    );
  }
  writeFileSync(outputPath, mergeMeshyExportDirectories(inputDirectories));
}
