import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildBradleyAvatar } from "./build-bradley-avatar";

const temporaryDirectories: string[] = [];

function sha256(file: Buffer) {
  return createHash("sha256").update(file).digest("hex");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("Bradley production asset build", () => {
  it("pins one repository command for every asset-processing tool", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["build:avatar"]).toBe(
      "tsx scripts/avatar/build-bradley-avatar.ts",
    );
    expect(packageJson.devDependencies.tsx).toBe("4.23.12");
    expect(packageJson.devDependencies["@gltf-transform/cli"]).toBe("4.4.2");
  });

  it("rebuilds the exact model and separate motion library byte-for-byte", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bradley-avatar-test-"));
    temporaryDirectories.push(directory);
    const modelPath = join(directory, "bradley-meshy-rigged.glb");
    const motionPath = join(directory, "bradley-motion-library.glb");

    buildBradleyAvatar(modelPath, motionPath);

    const model = await readFile(modelPath);
    const source = await readFile(
      resolve(process.cwd(), "assets/avatar-sources/bradley-meshy-rigged.glb"),
    );
    expect(model.byteLength).toBe(source.byteLength);
    expect(sha256(model)).toBe(sha256(source));

    const motion = await readFile(motionPath);
    const checkedInMotion = await readFile(
      resolve(process.cwd(), "public/avatars/bradley-motion-library.glb"),
    );
    expect(motion.byteLength).toBe(checkedInMotion.byteLength);
    expect(sha256(motion)).toBe(sha256(checkedInMotion));
  }, 60_000);
});
