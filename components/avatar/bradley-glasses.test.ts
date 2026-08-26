import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { avatarAsset } from "../../lib/avatar/config";
import { attachBradleyGlasses } from "./bradley-glasses";

describe("Bradley glasses attachment", () => {
  it("attaches one removable low-poly frame to the configured head bone", () => {
    const scene = new THREE.Group();
    const head = new THREE.Bone();
    head.name = "Head";
    scene.add(head);

    const glassesConfig = {
      frameColor: "#14211f",
      headBoneName: "Head",
      position: [0, 0, 0] as const,
      rotation: [0, 0, 0] as const,
    };
    const detach = attachBradleyGlasses(scene, glassesConfig);
    attachBradleyGlasses(scene, glassesConfig);

    const glasses = head.getObjectByName("BradleyGlasses");
    expect(glasses).toBeDefined();
    expect(head.children.filter((child) => child.name === "BradleyGlasses")).toHaveLength(1);
    expect(glasses?.children).toHaveLength(5);

    detach();
    expect(head.getObjectByName("BradleyGlasses")).toBeUndefined();
  });

  it("leaves the exact Meshy model untouched when glasses are disabled", () => {
    // Catches the renderer adding synthetic frames despite the exact-model contract.
    const scene = new THREE.Group();
    const detach = attachBradleyGlasses(scene, avatarAsset.glasses);

    expect(scene.children).toHaveLength(0);
    expect(() => detach()).not.toThrow();
  });
});
