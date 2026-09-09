import { statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import contentDocument from "../content/portfolio-content.json";
import {
  getVisibleWorldLinks,
  getWorldFocusIds,
  isRestingWorldSelection,
  isWorldLinkActive,
  isPortfolioVisualReady,
  portfolioContact,
  portfolioThreads,
  portfolioThroughline,
  portfolioWorldLinks,
  portfolioWorldNodeById,
  portfolioWorldNodes,
  portfolioWhatNodes,
} from "./portfolio-world";

describe("accepted portfolio world", () => {
  it("renders outline v5 as exactly 17 nodes", () => {
    expect(portfolioWorldNodes.map(({ id }) => id)).toEqual([
      "bradley",
      "infamous",
      "music-practice",
      "systems-consulting",
      "product-studio",
      "kickoff",
      "pitching",
      "reporting",
      "real-estate",
      "touring",
      "dubs",
      "writ",
      "thread-making-work-playable",
      "thread-philosophy",
    ]);
  });

  it("keeps the outline-v5 record order and takes every label from the content document", () => {
    const records = portfolioWorldNodes.filter(({ outlineType }) => outlineType !== "why");
    expect(records.map(({ id }) => id)).toEqual([
      "bradley",
      "infamous",
      "music-practice",
      "systems-consulting",
      "product-studio",
      "kickoff",
      "pitching",
      "reporting",
      "real-estate",
      "touring",
      "dubs",
      "writ",
    ]);
    for (const { id, label } of records) {
      expect(label).toBe(contentDocument.records[id as keyof typeof contentDocument.records].label);
    }
  });

  it("derives the seven Whats from the canonical record structures", () => {
    expect(portfolioWhatNodes.map(({ id }) => id)).toEqual([
      "kickoff",
      "pitching",
      "reporting",
      "real-estate",
      "touring",
      "dubs",
      "writ",
    ]);
    expect(portfolioWhatNodes.every(({ outlineType }) => outlineType === "what")).toBe(
      true,
    );
  });

  it("keeps the two Whys and their exact outline-v5 memberships", () => {
    expect(portfolioThreads.map(({ id, title, members }) => ({ id, title, members }))).toEqual([
      {
        id: "making-work-playable",
        title: contentDocument.threads["making-work-playable"].title,
        members: [
          "kickoff",
          "pitching",
          "reporting",
          "real-estate",
          "touring",
          "dubs",
          "writ",
        ],
      },
      {
        id: "philosophy",
        title: contentDocument.threads["philosophy"].title,
        members: ["pitching", "reporting", "real-estate", "touring", "writ"],
      },
    ]);
  });

  it("derives each Why node's thread identity from the canonical thread", () => {
    expect(
      portfolioThreads.map(({ id, nodeId }) => ({
        id,
        nodeId,
        derivedThreadId: portfolioWorldNodes.find((node) => node.id === nodeId)
          ?.threadId,
      })),
    ).toEqual(
      portfolioThreads.map(({ id, nodeId }) => ({
        id,
        nodeId,
        derivedThreadId: id,
      })),
    );
  });

  it("uses exactly the Where-to-What and sequence lines from outline v5", () => {
    expect(portfolioWorldLinks.map(({ from, to }) => [from, to])).toEqual([
      ["infamous", "music-practice"],
      ["music-practice", "kickoff"],
      ["music-practice", "pitching"],
      ["music-practice", "reporting"],
      ["systems-consulting", "real-estate"],
      ["systems-consulting", "touring"],
      ["product-studio", "dubs"],
      ["product-studio", "writ"],
      ["kickoff", "pitching"],
      ["pitching", "reporting"],
    ]);
  });

  it("shows the factual and membership web at rest", () => {
    const roots = [
      "thread-making-work-playable",
      "thread-philosophy",
    ];
    for (const selectedId of [null, "bradley"]) {
      expect(isRestingWorldSelection(selectedId)).toBe(true);
      const links = getVisibleWorldLinks({ selectedId });
      expect(
        links.filter(({ layer }) => layer === "story-root").map(({ to }) => to),
      ).toEqual(roots);
      expect(
        links
          .filter((link) => isWorldLinkActive(link, selectedId))
          .map(({ layer, to }) => `${layer}:${to}`),
      ).toEqual(links.map(({ layer, to }) => `${layer}:${to}`));
      expect(getWorldFocusIds({ activeThreadId: null, selectedId })).toEqual(
        new Set(["bradley", ...roots]),
      );
    }
    expect(isRestingWorldSelection("dubs")).toBe(false);
  });

  it("keeps the factual field present while another Why is foregrounded", () => {
    const links = getVisibleWorldLinks({
      selectedId: "thread-philosophy",
    });

    expect(links.filter(({ layer }) => layer === "factual")).toHaveLength(10);
  });

  it.each([
    [
      "thread-making-work-playable",
      [
        "story-root:bradley->thread-making-work-playable",
        "story-membership:thread-making-work-playable->kickoff",
        "story-membership:thread-making-work-playable->pitching",
        "story-membership:thread-making-work-playable->reporting",
        "story-membership:thread-making-work-playable->real-estate",
        "story-membership:thread-making-work-playable->touring",
        "story-membership:thread-making-work-playable->dubs",
        "story-membership:thread-making-work-playable->writ",
      ],
    ],
    [
      "thread-philosophy",
      [
        "story-root:bradley->thread-philosophy",
        "story-membership:thread-philosophy->pitching",
        "story-membership:thread-philosophy->reporting",
        "story-membership:thread-philosophy->real-estate",
        "story-membership:thread-philosophy->touring",
        "story-membership:thread-philosophy->writ",
      ],
    ],
  ])("activates exactly the signed links for %s", (selectedId, expected) => {
    const active = getVisibleWorldLinks({ selectedId })
      .filter((link) => isWorldLinkActive(link, selectedId))
      .map(({ layer, from, to }) => `${layer}:${from}->${to}`);

    expect(active).toEqual(expected);
  });

  it("roots a selected record's own composition on Bradley", () => {
    const links = getVisibleWorldLinks({ selectedId: "dubs" });
    const root = links.filter(({ layer }) => layer === "spotlight-root");

    expect(root).toEqual([
      { from: "bradley", to: "dubs", type: "spotlight", layer: "spotlight-root" },
    ]);
    expect(isWorldLinkActive(root[0], "dubs")).toBe(true);
    expect(getWorldFocusIds({ activeThreadId: null, selectedId: "dubs" })).toEqual(
      new Set(["bradley", "dubs", "product-studio", "thread-making-work-playable"]),
    );
    expect(links.filter(({ layer }) => layer === "story-root")).toEqual([]);
  });

  it("assigns the exact Where status contract", () => {
    expect(
      Object.fromEntries(
        portfolioWorldNodes.flatMap(({ id, status }) =>
          status ? [[id, status]] : [],
        ),
      ),
    ).toEqual({
      infamous: "past",
      "music-practice": "active",
      "product-studio": "active",
      "systems-consulting": "active",
    });
  });
});

describe("authored content contract", () => {
  it("ships every ready visual asset within the Cloudflare per-file limit", () => {
    const assetUrls = new Set<string>();
    for (const node of portfolioWorldNodes) {
      for (const block of node.body) {
        if (typeof block === "string" || block.type !== "visual" || block.status !== "ready") {
          continue;
        }
        for (const url of [block.src, block.frameSrc, block.captionsSrc, block.poster]) {
          if (url) assetUrls.add(url);
        }
        for (const slide of block.slides ?? []) {
          for (const asset of slide.assets) assetUrls.add(asset.src);
        }
      }
    }

    for (const url of assetUrls) {
      const size = statSync(join(process.cwd(), "public", url.slice(1))).size;
      expect(size, url).toBeLessThanOrEqual(25 * 1024 * 1024);
    }
  });

  it("publishes the Dubs visual as three complete Apple-framed slides", () => {
    const dubsVisual = portfolioWorldNodeById
      .get("dubs")!
      .body.find((block) => typeof block !== "string" && block.type === "visual");

    expect(dubsVisual).toMatchObject({
      type: "visual",
      id: "dubs-loop",
      status: "ready",
      format: "gallery",
      treatment: "sequence",
      sourceStatus: "exists",
    });
    expect(dubsVisual && typeof dubsVisual !== "string" && dubsVisual.type === "visual"
      ? dubsVisual.slides?.map((slide) => slide.assets.length)
      : undefined).toEqual([4, 3, 1]);
  });

  it("treats captions, not an optional poster, as the video readiness boundary", () => {
    expect(
      isPortfolioVisualReady({
        type: "visual",
        id: "captioned-video",
        status: "ready",
        purpose: "Show the interaction",
        format: "video",
        src: "/visuals/demo.mp4",
        captionsSrc: "/visuals/demo.en.vtt",
      }),
    ).toBe(true);
    expect(
      isPortfolioVisualReady({
        type: "visual",
        id: "adaptive-captioned-video",
        status: "ready",
        purpose: "Show the interaction sharply",
        format: "video",
        muxPlaybackId: "mux-playback-id",
        captionsSrc: "/visuals/demo.en.vtt",
      }),
    ).toBe(true);
    expect(
      isPortfolioVisualReady({
        type: "visual",
        id: "uncaptioned-video",
        status: "ready",
        purpose: "Show the interaction",
        format: "video",
        src: "/visuals/demo.mp4",
      }),
    ).toBe(false);
  });

  it("publishes selected campaign redactions without untreated streaming alternatives", () => {
    for (const nodeId of ["kickoff", "pitching"]) {
      const visual = portfolioWorldNodeById
        .get(nodeId)!
        .body.find(
          (block) =>
            typeof block !== "string" &&
            block.type === "visual" &&
            block.format === "video",
        );
      if (!visual || typeof visual === "string" || visual.type !== "visual") {
        throw new Error(`${nodeId} has no video visual`);
      }

      expect(visual.muxPlaybackId).toBeUndefined();
      expect(visual.src).toMatch(/^\/visuals\/campaign\/.+\.mp4$/);
      expect(isPortfolioVisualReady(visual)).toBe(true);
    }
  });

  it("gives every node a complete working record", () => {
    for (const node of portfolioWorldNodes) {
      expect(node.label).not.toBe("");
      expect(node.summary).not.toBe("");
      expect(node.body.length).toBeGreaterThan(0);
      expect(
        node.body.every((block) => {
          if (typeof block === "string") {
            return block.length > 0;
          }

          if (block.type === "copy-placeholder") {
            return block.id.length > 0 && block.prompt.length > 0;
          }

          return block.id.length > 0 && block.purpose.length > 0;
        }),
      ).toBe(true);
    }
  });

  it("keeps the public identity content in place", () => {
    expect(portfolioThroughline).not.toBe("");
    expect(portfolioContact.email).toBe("bradley@bradleyberkman.com");
    expect(portfolioContact.socials.map(({ label }) => label)).toEqual([
      "LinkedIn",
      "GitHub",
      "Instagram",
    ]);
  });
});
