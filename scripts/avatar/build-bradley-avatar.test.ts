import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LinearInterpolant, Object3D, QuaternionLinearInterpolant, Vector3 } from "three";
import {
  buildBradleyAvatar,
  appendAvatarGestures,
  retargetedClipNames,
  portraitClipNames,
  legacySourcePath,
  portraitSourcePath,
  prepareAvatarGlb,
  shippedClipNames,
} from "./build-bradley-avatar";
import { parseGlb, readFloatAccessor, readGlbJson, type ParsedGlb } from "./glb";

function samplePose(glb: ParsedGlb, clipName: string, fraction: number) {
  const nodes = glb.json.nodes.map((node) => {
    const object = new Object3D();
    object.position.fromArray(node.translation ?? [0, 0, 0]);
    object.quaternion.fromArray(node.rotation ?? [0, 0, 0, 1]);
    object.scale.fromArray(node.scale ?? [1, 1, 1]);
    return object;
  });
  glb.json.nodes.forEach((node, index) => {
    node.children?.forEach((child) => nodes[index]!.add(nodes[child]!));
  });
  const clip = glb.json.animations!.find((clip) => clip.name === clipName)!;
  const duration = Math.max(...clip.samplers.map((sampler) =>
    readFloatAccessor(glb, sampler.input).at(-1)!,
  ));
  for (const channel of clip.channels) {
    const sampler = clip.samplers[channel.sampler]!;
    const times = readFloatAccessor(glb, sampler.input);
    const values = readFloatAccessor(glb, sampler.output);
    const node = nodes[channel.target.node]!;
    if (channel.target.path === "rotation") {
      node.quaternion.fromArray(new QuaternionLinearInterpolant(times, values, 4).evaluate(duration * fraction));
    } else if (channel.target.path === "translation" || channel.target.path === "scale") {
      const property = channel.target.path === "translation" ? node.position : node.scale;
      property.fromArray(new LinearInterpolant(times, values, 3).evaluate(duration * fraction));
    }
  }
  return (name: string) => nodes[glb.json.nodes.findIndex((node) => node.name === name)]!;
}

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
  it("relaxes the idle shoulders without squeezing the upper arms against the torso", () => {
    const source = readFileSync(portraitSourcePath);
    const native = parseGlb(source);
    const prepared = parseGlb(prepareAvatarGlb(source, readFileSync(legacySourcePath)));
    // Preserve the bind transforms; this is a clip correction, not a re-rig.
    expect(prepared.json.nodes).toEqual(native.json.nodes);
    for (const fraction of [0, 0.25, 0.5, 0.75, 0.99]) {
      const before = samplePose(native, "Idle_11", fraction);
      const after = samplePose(prepared, "Idle", fraction);
      for (const side of ["Left", "Right"]) {
        const shoulderBefore = before(`${side}Arm`).getWorldPosition(new Vector3());
        const shoulderAfter = after(`${side}Arm`).getWorldPosition(new Vector3());
        const shoulderDrop = shoulderBefore.y - shoulderAfter.y;
        expect(shoulderDrop).toBeGreaterThan(0.005);
        expect(shoulderDrop).toBeLessThan(0.02);
        const handBefore = before(`${side}Hand`).getWorldPosition(new Vector3());
        const handAfter = after(`${side}Hand`).getWorldPosition(new Vector3());
        const inwardTravel = Math.abs(handBefore.x) - Math.abs(handAfter.x);
        expect(inwardTravel).toBeGreaterThan(0.04);
        expect(inwardTravel).toBeLessThan(0.13);
        expect(after(`${side}Arm`).quaternion.angleTo(before(`${side}Arm`).quaternion)).toBeLessThan(0.15);
      }
      for (const node of native.json.nodes) {
        if (!node.name || /^(Left|Right)(Arm|Shoulder)$/.test(node.name)) continue;
        expect(after(node.name).quaternion.toArray()).toEqual(before(node.name).quaternion.toArray());
        expect(after(node.name).position.toArray()).toEqual(before(node.name).position.toArray());
      }
    }
  });

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

  it("carries the portrait's own clips and retargets the legacy agree gesture", () => {
    const prepared = readGlbJson(
      prepareAvatarGlb(
        readFileSync(resolve(process.cwd(), portraitSourcePath)),
        readFileSync(resolve(process.cwd(), legacySourcePath)),
      ),
    );

    expect(prepared.animations?.map((animation) => animation.name)).toEqual(
      [...Object.values(portraitClipNames), ...retargetedClipNames],
    );
    expect(prepared.extensionsUsed).toBeUndefined();
    expect(prepared.materials?.[0]?.extensions).toBeUndefined();
    expect(prepared.materials?.[0]?.emissiveFactor).toEqual([0.6, 0.6, 0.6]);
    // Retargeted clips carry rotations and only the hips' translation.
    const agree = prepared.animations?.find((animation) => animation.name === "Agree_Gesture");
    const paths = new Set(agree?.channels.map((channel) => channel.target.path));
    expect(paths).toEqual(new Set(["rotation", "translation"]));
    const hips = prepared.nodes.findIndex((node) => node.name === "Hips");
    expect(
      agree?.channels
        .filter((channel) => channel.target.path === "translation")
        .map((channel) => channel.target.node),
    ).toEqual([hips]);
  });

  it("adds a real wave without rewriting the saved idle, mesh, or any existing clip", () => {
    const source = prepareAvatarGlb(readFileSync(portraitSourcePath), readFileSync(legacySourcePath));
    const before = parseGlb(source);
    const after = parseGlb(appendAvatarGestures(source, readFileSync(legacySourcePath)));
    expect(after.json.nodes).toEqual(before.json.nodes);
    expect(after.json.meshes).toEqual(before.json.meshes);
    expect(after.json.materials).toEqual(before.json.materials);
    expect(after.json.animations!.slice(0, -1)).toEqual(before.json.animations);
    expect(sha256(after.binary.subarray(0, before.binary.length))).toBe(sha256(before.binary));
    expect(after.json.animations!.at(-1)!.name).toBe("Wave_One_Hand");
    const hands = [0, 0.25, 0.5, 0.75, 0.99].map(fraction =>
      samplePose(after, "Wave_One_Hand", fraction)("RightHand").getWorldPosition(new Vector3()),
    );
    expect(Math.max(...hands.map(hand => hand.distanceTo(hands[0]!)))).toBeGreaterThan(0.1);
  });

  it("rebuilds the checked-in model byte-for-byte", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bradley-avatar-test-"));
    temporaryDirectories.push(directory);
    const modelPath = join(directory, "bradley-quiet-portrait.glb");

    buildBradleyAvatar(modelPath);

    const model = await readFile(modelPath);
    const checkedIn = await readFile(
      resolve(process.cwd(), "public/avatars/bradley-quiet-portrait.glb"),
    );
    expect(model.byteLength).toBe(checkedIn.byteLength);
    expect(sha256(model)).toBe(sha256(checkedIn));
    expect(readGlbJson(model).animations?.map((animation) => animation.name)).toEqual(
      shippedClipNames,
    );
  }, 60_000);
});
