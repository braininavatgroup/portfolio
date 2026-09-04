const MUX_PLAYBACK_ID = /^[A-Za-z0-9_-]+$/;
const MUX_STREAM_ORIGIN = "https://stream.mux.com";
// For these 2940×1912 assets, Mux's 720p threshold leaves 1080p, 1440p,
// and source-resolution renditions while omitting the visibly soft tiers.
const MUX_SCREEN_RECORDING_FLOOR = "min_resolution=720p";

type PortfolioHlsInstance = {
  attachMedia(video: HTMLVideoElement): void;
  destroy(): void;
  loadSource(source: string): void;
  on?(
    event: string,
    listener: (event: string, data: { fatal?: boolean }) => void,
  ): void;
};

type PortfolioHlsConstructor = {
  new (config: { capLevelToPlayerSize: boolean }): PortfolioHlsInstance;
  Events?: { ERROR: string };
  isSupported(): boolean;
};

export type PortfolioHlsLoader = () => Promise<{
  default: PortfolioHlsConstructor;
}>;

export function muxPortfolioVideoUrl(playbackId: string): string {
  if (!MUX_PLAYBACK_ID.test(playbackId)) {
    throw new Error("Invalid Mux playback ID");
  }
  return `${MUX_STREAM_ORIGIN}/${playbackId}.m3u8?${MUX_SCREEN_RECORDING_FLOOR}`;
}

const loadHlsJs: PortfolioHlsLoader = async () => {
  const hlsLibrary = await import("hls.js");
  return { default: hlsLibrary.default };
};

export async function attachPortfolioVideoSource(
  video: HTMLVideoElement,
  playbackId: string,
  loadHls: PortfolioHlsLoader = loadHlsJs,
  fallbackSrc?: string,
): Promise<() => void> {
  const source = muxPortfolioVideoUrl(playbackId);
  const setFallbackSource = () => {
    if (fallbackSrc) video.src = fallbackSrc;
  };
  const { default: Hls } = await loadHls();
  if (Hls.isSupported()) {
    const hls = new Hls({ capLevelToPlayerSize: true });
    let destroyed = false;
    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      hls.destroy();
    };
    if (fallbackSrc && Hls.Events?.ERROR && hls.on) {
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!destroyed && data.fatal) {
          destroy();
          setFallbackSource();
        }
      });
    }
    hls.loadSource(source);
    hls.attachMedia(video);
    return destroy;
  }

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.addEventListener("error", setFallbackSource, { once: true });
    video.src = source;
    return () => {
      video.removeEventListener("error", setFallbackSource);
      video.removeAttribute("src");
    };
  }

  setFallbackSource();
  return () => {};
}
