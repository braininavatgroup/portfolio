import { describe, expect, it } from "vitest";
import { getSceneQuality, isSoftwareRenderer } from "./scene-budget";

describe("scene quality budget", () => {
  it("keeps normal rendering bounded", () => {
    expect(getSceneQuality({ reducedMotion: false, lowPower: false })).toEqual({
      dpr: [1, 1.5],
      glass: true,
      pulses: true,
      cameraTravel: true,
      sphereSegments: 32,
    });
  });

  it("degrades glass and geometry first on low-power devices", () => {
    expect(getSceneQuality({ reducedMotion: false, lowPower: true })).toEqual({
      dpr: [1, 1],
      glass: false,
      pulses: true,
      cameraTravel: true,
      sphereSegments: 16,
    });
  });

  it("turns off ambient motion and camera travel for reduced motion", () => {
    expect(getSceneQuality({ reducedMotion: true, lowPower: false })).toEqual({
      dpr: [1, 1],
      glass: false,
      pulses: false,
      cameraTravel: false,
      sphereSegments: 16,
    });
  });
});

describe("software renderer detection", () => {
  it("reads renderer information from the raw WebGL context", () => {
    const extension = { UNMASKED_RENDERER_WEBGL: 37446 };
    const context = {
      getExtension: (name: string) =>
        name === "WEBGL_debug_renderer_info" ? extension : null,
      getParameter: (parameter: number) =>
        parameter === extension.UNMASKED_RENDERER_WEBGL
          ? "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))"
          : "",
    };

    expect(isSoftwareRenderer(context)).toBe(true);
  });

  it("does not downgrade hardware renderers or unavailable debug information", () => {
    const hardwareExtension = { UNMASKED_RENDERER_WEBGL: 37446 };

    expect(
      isSoftwareRenderer({
        getExtension: () => hardwareExtension,
        getParameter: () => "ANGLE Metal Renderer: Apple M2",
      }),
    ).toBe(false);
    expect(
      isSoftwareRenderer({
        getExtension: () => null,
        getParameter: () => "",
      }),
    ).toBe(false);
  });
});
