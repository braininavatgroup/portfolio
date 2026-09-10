// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  attachPortfolioVideoSource,
  muxPortfolioVideoUrl,
} from "./portfolio-video";

describe("portfolio video delivery", () => {
  it("builds only the portfolio's canonical Mux HLS URL", () => {
    expect(muxPortfolioVideoUrl("abc123XYZ")).toBe(
      "https://stream.mux.com/abc123XYZ.m3u8?min_resolution=720p",
    );
    expect(() => muxPortfolioVideoUrl("https://attacker.example/video")).toThrow(
      /Invalid Mux playback ID/,
    );
  });

  it("uses browser-native HLS when the JavaScript player is unsupported", async () => {
    const video = document.createElement("video");
    vi.spyOn(video, "canPlayType").mockReturnValue("probably");
    class UnsupportedHls {
      static isSupported() {
        return false;
      }

      attachMedia() {}
      destroy() {}
      loadSource() {}
    }
    const loadHls = vi.fn(async () => ({ default: UnsupportedHls }));

    const detach = await attachPortfolioVideoSource(
      video,
      "native123",
      loadHls,
      "/visuals/native-fallback.mp4",
    );

    expect(video.getAttribute("src")).toBe(
      "https://stream.mux.com/native123.m3u8?min_resolution=720p",
    );
    expect(loadHls).toHaveBeenCalledTimes(1);

    video.dispatchEvent(new Event("error"));
    expect(video.getAttribute("src")).toBe("/visuals/native-fallback.mp4");

    detach();
    expect(video.hasAttribute("src")).toBe(false);
  });

  it("prefers HLS.js when Chromium makes an unusable native HLS claim", async () => {
    const video = document.createElement("video");
    vi.spyOn(video, "canPlayType").mockReturnValue("maybe");
    const destroy = vi.fn();
    const attachMedia = vi.fn();
    const loadSource = vi.fn();
    const construct = vi.fn();
    class Hls {
      static isSupported() {
        return true;
      }

      attachMedia = attachMedia;
      destroy = destroy;
      loadSource = loadSource;

      constructor(config: { capLevelToPlayerSize: boolean }) {
        construct(config);
      }
    }

    const detach = await attachPortfolioVideoSource(
      video,
      "adaptive123",
      async () => ({ default: Hls }),
    );

    expect(construct).toHaveBeenCalledWith({ capLevelToPlayerSize: true });
    expect(loadSource).toHaveBeenCalledWith(
      "https://stream.mux.com/adaptive123.m3u8?min_resolution=720p",
    );
    expect(attachMedia).toHaveBeenCalledWith(video);
    expect(video.hasAttribute("src")).toBe(false);

    detach();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("falls back to MP4 when HLS.js reports a fatal playback error", async () => {
    const video = document.createElement("video");
    const destroy = vi.fn();
    let handleError: ((event: string, data: { fatal: boolean }) => void) | undefined;
    class Hls {
      static Events = { ERROR: "hlsError" };

      static isSupported() {
        return true;
      }

      attachMedia() {}
      destroy = destroy;
      loadSource() {}
      on(event: string, listener: (event: string, data: { fatal: boolean }) => void) {
        if (event === Hls.Events.ERROR) handleError = listener;
      }
    }

    const detach = await attachPortfolioVideoSource(
      video,
      "fatal123",
      async () => ({ default: Hls }),
      "/visuals/fatal-fallback.mp4",
    );

    handleError?.("hlsError", { fatal: false });
    expect(video.hasAttribute("src")).toBe(false);

    handleError?.("hlsError", { fatal: true });
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(video.getAttribute("src")).toBe("/visuals/fatal-fallback.mp4");

    detach();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("uses the MP4 only when neither adaptive playback path is available", async () => {
    const video = document.createElement("video");
    vi.spyOn(video, "canPlayType").mockReturnValue("");
    class UnsupportedHls {
      static isSupported() {
        return false;
      }

      attachMedia() {}
      destroy() {}
      loadSource() {}
    }

    await attachPortfolioVideoSource(
      video,
      "unavailable123",
      async () => ({ default: UnsupportedHls }),
      "/visuals/fallback.mp4",
    );

    expect(video.getAttribute("src")).toBe("/visuals/fallback.mp4");
  });
});
