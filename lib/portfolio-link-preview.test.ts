import { describe, expect, it } from "vitest";
import { portfolioLinkPreview } from "./portfolio-link-preview";
import {
  portfolioThreadById,
  portfolioWorldNodeById,
  type PortfolioVisualBlock,
} from "./portfolio-world";

const visual = (overrides: Partial<PortfolioVisualBlock>): PortfolioVisualBlock => ({
  type: "visual",
  id: "v",
  status: "ready",
  purpose: "Purpose",
  ...overrides,
});

describe("portfolioLinkPreview", () => {
  it("reads a video's poster, a gallery's first frame, and an image's own source", () => {
    expect(
      portfolioLinkPreview([
        visual({ format: "video", src: "/v.mp4", captionsSrc: "/v.vtt", poster: "/poster.png" }),
      ]),
    ).toEqual({ src: "/poster.png", alt: "Purpose" });
    expect(
      portfolioLinkPreview([
        visual({
          format: "gallery",
          slides: [{ title: "", caption: "", assets: [{ src: "/a.png", alt: "First frame" }] }],
        }),
      ]),
    ).toEqual({ src: "/a.png", alt: "First frame" });
    expect(portfolioLinkPreview([visual({ format: "image", src: "/i.png", alt: "Image" })])).toEqual({
      src: "/i.png",
      alt: "Image",
    });
  });

  it("skips prose, planned visuals, and interactive demos, and takes the first ready still", () => {
    expect(
      portfolioLinkPreview([
        "A paragraph.",
        visual({ status: "planned", format: "image", src: "/planned.png" }),
        visual({ format: "interactive", preview: "quarterly-dashboard", href: "/demos/x" }),
        visual({ format: "video", src: "/v.mp4", captionsSrc: "/v.vtt" }),
        visual({ format: "image", src: "/first.png" }),
        visual({ format: "image", src: "/second.png" }),
      ]),
    ).toEqual({ src: "/first.png", alt: "Purpose" });
    expect(portfolioLinkPreview(["Only prose."])).toBeUndefined();
  });

  it("resolves the live records the About page links to", () => {
    const still = (id: string) => portfolioLinkPreview(portfolioWorldNodeById.get(id)!.body)?.src;
    expect(still("kickoff")).toBe("/visuals/campaign/campaign-kickoff-poster.png");
    expect(still("pitching")).toBe("/visuals/campaign/pitch-pipeline-poster.png");
    expect(still("touring")).toBe("/visuals/touring/manager-advance.png");
    expect(still("dubs")).toBe("/visuals/dubs/lock-screen.png");
    expect(still("writ")).toBe("/visuals/writ/output-priority.png");
    expect(still("real-estate")).toBeUndefined();
    expect(still("infamous")).toBe("/visuals/clients/infamous/all-day-i-dream.webp");
    expect(portfolioLinkPreview(portfolioThreadById.get("philosophy")!.body)).toBeUndefined();
  });
});
