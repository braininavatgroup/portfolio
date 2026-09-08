import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseGlb, writeGlb } from "./glb";
import { foldClipArms, retargetClips } from "./retarget-clips";
import { applySavedIdlePose } from "./apply-idle-pose";
import { repairAvatarTexture } from "./repair-avatar-texture";

/**
 * Builds the shipped Bradley avatar from the two checked-in Meshy sources.
 *
 * `bradley-quiet-portrait.glb` is the textured character with its own clip set
 * (see `merge-meshy-clips.ts`). `bradley-meshy-rigged.glb` is the earlier
 * untextured export whose agree gesture is retargeted onto the portrait rig
 * because the portrait was never exported with a conversational nod.
 */

export const portraitSourcePath = "assets/avatar-sources/bradley-quiet-portrait.glb";
export const legacySourcePath = "assets/avatar-sources/bradley-meshy-rigged.glb";
export const idlePosePath = "assets/avatar-sources/bradley-idle-pose.json";
const textureRepairPrefix = "assets/avatar-sources/bradley-texture-repair";

/** Meshy's agree gesture holds the arms out in a wide A; fold them to the hips. */
const relaxedArms = { shoulderAdductionRadians: 0.4 } as const;

/** Share the idle correction between clavicles and upper arms to avoid pinched sleeves. */
export const portraitArmRelaxation: Record<string, {
  upperArmRadians: number;
  shoulderDropRadians: number;
}> = {
  Idle: { upperArmRadians: 0.1, shoulderDropRadians: 0.08 },
};

/** Clips carried over from the earlier Meshy export, in shipped order. */
export const retargetedClips = [["Agree_Gesture", relaxedArms]] as const;

export const retargetedClipNames = retargetedClips.map(([name]) => name);

/** Meshy clip name -> shipped clip name for the portrait's own clips. */
export const portraitClipNames: Record<string, string> = {
  Idle_11: "Idle",
  Depressed_Full_Turn_Left: "Full_Turn_Left",
  Swim_Forward: "Swim_Forward",
  Swim_Idle: "Swim_Idle",
  walking_man: "Walking",
  running: "Running",
  BackLeft_run: "BackLeft_run",
  swimming_to_edge: "swimming_to_edge",
  All_Night_Dance: "All_Night_Dance",
  Cardio_Dance: "Cardio_Dance",
  Denim_Pop_Dance: "Denim_Pop_Dance",
  FunnyDancing_02: "Funny_Dancing_02",
  FunnyDancing_03: "Funny_Dancing_03",
  Not_Your_Mom: "Not_Your_Mom",
  Step_Hip_Hop_Dance: "Step_Hip_Hop_Dance",
  jazz_danc: "Jazz_Dance",
};

export const shippedClipNames = [
  ...Object.values(portraitClipNames),
  ...retargetedClipNames,
  "Wave_One_Hand",
];

const textureMaximumSize = "1024";
const emissiveStrength = 0.6;

export function prepareAvatarGlb(portrait: Buffer, legacy: Buffer) {
  const target = parseGlb(portrait);
  const byMeshyName = new Map(
    (target.json.animations ?? []).map((animation) => [animation.name, animation] as const),
  );
  target.json.animations = Object.entries(portraitClipNames).map(([meshyName, name]) => {
    const animation = byMeshyName.get(meshyName);
    if (!animation) throw new Error(`Missing portrait clip: ${meshyName}`);
    return { ...animation, name };
  });
  for (const animation of target.json.animations) {
    const relaxation = portraitArmRelaxation[animation.name ?? ""];
    if (relaxation) {
      foldClipArms(target, animation, relaxation.upperArmRadians, relaxation.shoulderDropRadians);
    }
  }
  retargetClips(target, parseGlb(legacy), retargetedClips);

  // Meshy ships the base color doubled as a full-strength emissive map with a
  // boosted specular so its viewer looks unlit. Keep the emissive at a fraction
  // so the stage lights still shape the figure without it going muddy.
  for (const material of target.json.materials ?? []) {
    material.emissiveFactor = [emissiveStrength, emissiveStrength, emissiveStrength];
    delete material.extensions;
  }
  delete target.json.extensionsUsed;
  delete target.json.extensionsRequired;
  return writeGlb(target);
}

/** Append new gestures after the hash-validated pose bake, preserving its exact baseline. */
export function appendAvatarGestures(posed: Buffer, legacy: Buffer) {
  const target = parseGlb(posed);
  retargetClips(target, parseGlb(legacy), [["Wave_One_Hand", relaxedArms]]);
  return writeGlb(target);
}

export function buildBradleyAvatar(
  outputPath = "public/avatars/bradley-quiet-portrait.glb",
) {
  const repositoryRoot = process.cwd();
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "bradley-avatar-build-"));
  const gltfTransform = resolve(repositoryRoot, "node_modules/.bin/gltf-transform");
  const preparedPath = join(temporaryDirectory, "prepared.glb");
  const resizedPath = join(temporaryDirectory, "resized.glb");
  const webpPath = join(temporaryDirectory, "webp.glb");
  const resampledPath = join(temporaryDirectory, "resampled.glb");
  const dedupedPath = join(temporaryDirectory, "deduped.glb");
  const baselinePath = join(temporaryDirectory, "baseline.glb");
  const absoluteOutputPath = resolve(repositoryRoot, outputPath);

  try {
    const portrait = readFileSync(resolve(repositoryRoot, portraitSourcePath));
    const repair = JSON.parse(readFileSync(resolve(repositoryRoot, `${textureRepairPrefix}.json`), "utf8")) as {
      sourceSha256: string; sourceUvSha256: string;
    };
    if (createHash("sha256").update(portrait).digest("hex") !== repair.sourceSha256) {
      throw new Error("Regenerate the texture repair for the changed portrait source.");
    }
    writeFileSync(
      preparedPath,
      prepareAvatarGlb(
        portrait,
        readFileSync(resolve(repositoryRoot, legacySourcePath)),
      ),
    );
    execFileSync(gltfTransform, [
      "resize",
      preparedPath,
      resizedPath,
      "--width",
      textureMaximumSize,
      "--height",
      textureMaximumSize,
    ]);
    execFileSync(gltfTransform, ["webp", resizedPath, webpPath]);
    execFileSync(gltfTransform, ["resample", webpPath, resampledPath]);
    execFileSync(gltfTransform, ["dedup", resampledPath, dedupedPath]);
    execFileSync(gltfTransform, ["prune", dedupedPath, baselinePath]);
    const posed = applySavedIdlePose(
      readFileSync(baselinePath),
      readFileSync(resolve(repositoryRoot, idlePosePath), "utf8"),
    );
    mkdirSync(dirname(absoluteOutputPath), { recursive: true });
    writeFileSync(absoluteOutputPath, repairAvatarTexture(
      appendAvatarGestures(posed, readFileSync(resolve(repositoryRoot, legacySourcePath))),
      readFileSync(resolve(repositoryRoot, `${textureRepairPrefix}-uv.bin`)),
      readFileSync(resolve(repositoryRoot, `${textureRepairPrefix}.webp`)),
      repair.sourceUvSha256,
    ));
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildBradleyAvatar();
}
