export type SceneQualityInput = {
  reducedMotion: boolean;
  lowPower: boolean;
};

export type SceneQuality = {
  dpr: [number, number];
  glass: boolean;
  pulses: boolean;
  cameraTravel: boolean;
  sphereSegments: number;
};

type RendererInfoContext = {
  getExtension: (name: string) => { UNMASKED_RENDERER_WEBGL: number } | null;
  getParameter: (parameter: number) => unknown;
};

export function isSoftwareRenderer(context: RendererInfoContext): boolean {
  const rendererInfo = context.getExtension("WEBGL_debug_renderer_info");
  const renderer = rendererInfo
    ? String(context.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL))
    : "";

  return /swiftshader|software/i.test(renderer);
}

export function getSceneQuality({
  reducedMotion,
  lowPower,
}: SceneQualityInput): SceneQuality {
  if (reducedMotion) {
    return {
      dpr: [1, 1],
      glass: false,
      pulses: false,
      cameraTravel: false,
      sphereSegments: 16,
    };
  }

  if (lowPower) {
    return {
      dpr: [1, 1],
      glass: false,
      pulses: true,
      cameraTravel: true,
      sphereSegments: 16,
    };
  }

  return {
    dpr: [1, 1.5],
    glass: true,
    pulses: true,
    cameraTravel: true,
    sphereSegments: 32,
  };
}
