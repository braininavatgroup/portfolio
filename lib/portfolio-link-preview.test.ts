import { describe, expect, it } from "vitest";
import { portfolioLinkPreview, portfolioLinkPreviewLayout } from "./portfolio-link-preview";
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

  it("skips prose, planned visuals, and uncaptured demos, and takes the first ready still", () => {
    expect(
      portfolioLinkPreview([
        "A paragraph.",
        visual({ status: "planned", format: "image", src: "/planned.png" }),
        visual({ format: "interactive", href: "/demos/x" }),
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
    expect(still("touring")).toBe("/visuals/touring/advance-demo.png");
    expect(still("dubs")).toBe("/visuals/dubs/lock-screen.png");
    expect(still("writ")).toBe("/visuals/writ/output-priority.png");
    expect(still("real-estate")).toBe("/visuals/real-estate/quarterly-dashboard.png");
    expect(still("infamous")).toBe("/visuals/clients/infamous/all-day-i-dream.webp");
    expect(portfolioLinkPreview(portfolioThreadById.get("philosophy")!.body)).toBeUndefined();
  });
});

describe("portfolioLinkPreviewLayout", () => {
  const bounds = { left: 320, right: 960, top: 56, bottom: 884 };
  const size = { width: 400, height: 322 };

  it("opens below a link when the preview fits", () => {
    expect(portfolioLinkPreviewLayout(
      { left: 360, right: 440, top: 100, bottom: 124 }, bounds, size, 8,
    )).toMatchObject({ left: 360, top: 132, width: 400, height: 322, placement: "below" });
  });

  it("opens above a low link and shifts away from the right edge", () => {
    expect(portfolioLinkPreviewLayout(
      { left: 850, right: 930, top: 800, bottom: 824 }, bounds, size, 8,
    )).toMatchObject({ left: 560, top: 470, width: 400, height: 322, placement: "above" });
  });

  it("fits a narrow pane without crossing either horizontal edge", () => {
    expect(portfolioLinkPreviewLayout(
      { left: 330, right: 410, top: 100, bottom: 124 },
      { ...bounds, left: 350, right: 650 }, size, 8,
    )).toMatchObject({ left: 350, width: 300 });
  });

  it("uses the roomier side and reduces height in a short pane", () => {
    expect(portfolioLinkPreviewLayout(
      { left: 360, right: 440, top: 230, bottom: 254 },
      { ...bounds, bottom: 400 }, size, 8,
    )).toMatchObject({ top: 56, height: 166, placement: "above" });
  });
});
