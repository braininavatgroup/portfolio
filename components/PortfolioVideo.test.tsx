// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortfolioVideo } from "./PortfolioReader";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PortfolioVideo", () => {
  it("keeps the MP4 dormant until a native Mux stream fails", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("probably");

    render(
      <PortfolioVideo
        aria-label="Campaign walkthrough"
        captionsSrc="/visuals/campaign.en.vtt"
        fallbackSrc="/visuals/campaign.mp4"
        muxPlaybackId="mux123"
      />,
    );

    const video = screen.getByLabelText("Campaign walkthrough");
    await waitFor(() =>
      expect(video.getAttribute("src")).toBe(
        "https://stream.mux.com/mux123.m3u8?min_resolution=720p",
      ),
    );
    expect(video.querySelector("source")).toBeNull();
    expect(video.querySelector("track")?.getAttribute("src")).toBe(
      "/visuals/campaign.en.vtt",
    );

    video.dispatchEvent(new Event("error"));
    await waitFor(() =>
      expect(video.getAttribute("src")).toBe("/visuals/campaign.mp4"),
    );
  });
});
