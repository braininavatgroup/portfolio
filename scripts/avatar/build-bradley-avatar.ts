import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  copyFileSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { processBradleyGlb } from "./process-bradley-glb";

const sourcePath = "assets/avatar-sources/bradley-meshy-rigged.glb";
const motionPath = "assets/avatar-sources/orange-justice-cc0.json";

export function buildBradleyAvatar(
  modelOutputPath = "public/avatars/bradley-meshy-rigged.glb",
  motionOutputPath = "public/avatars/bradley-motion-library.glb",
) {
  const repositoryRoot = process.cwd();
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "bradley-avatar-build-"));
  const gltfTransform = resolve(repositoryRoot, "node_modules/.bin/gltf-transform");
  const coloredPath = join(temporaryDirectory, "colored.glb");
  const weldedPath = join(temporaryDirectory, "welded.glb");
  const simplifiedPath = join(temporaryDirectory, "simplified.glb");
  const resampledPath = join(temporaryDirectory, "resampled.glb");
  const absoluteModelOutputPath = resolve(repositoryRoot, modelOutputPath);
  const absoluteMotionOutputPath = resolve(repositoryRoot, motionOutputPath);

  try {
    mkdirSync(dirname(absoluteModelOutputPath), { recursive: true });
    copyFileSync(resolve(repositoryRoot, sourcePath), absoluteModelOutputPath);
    writeFileSync(
      coloredPath,
      processBradleyGlb(
        readFileSync(resolve(repositoryRoot, sourcePath)),
        JSON.parse(readFileSync(resolve(repositoryRoot, motionPath), "utf8")),
      ),
    );
    execFileSync(gltfTransform, ["weld", coloredPath, weldedPath]);
    execFileSync(gltfTransform, [
      "simplify",
      weldedPath,
      simplifiedPath,
      "--ratio",
      "0.5",
      "--error",
      "0.01",
    ]);
    execFileSync(gltfTransform, ["resample", simplifiedPath, resampledPath]);
    mkdirSync(dirname(absoluteMotionOutputPath), { recursive: true });
    execFileSync(gltfTransform, ["prune", resampledPath, absoluteMotionOutputPath]);
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildBradleyAvatar();
}
