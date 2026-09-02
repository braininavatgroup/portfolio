import { describe, expect, it } from "vitest";
import {
  getVisibleWorldLinks,
  getWorldFocusIds,
  isWorldLinkActive,
  isPortfolioVisualReady,
  portfolioContact,
  portfolioThreads,
  portfolioThroughline,
  portfolioWorldLinks,
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
      "yoohoo",
      "thread-making-work-playable",
      "thread-from-argument-to-instrument",
      "thread-authorship",
      "thread-philosophy",
    ]);
  });

  it("uses the exact outline-v5 record names", () => {
    expect(
      portfolioWorldNodes
        .filter(({ outlineType }) => outlineType !== "why")
        .map(({ id, label }) => [id, label]),
    ).toEqual([
      ["bradley", "Bradley Berkman"],
      ["infamous", "INFAMOUS PR"],
      ["music-practice", "Brain in a Vat Music Promotions Agency"],
      ["systems-consulting", "Brain in a Vat Systems & AI Consulting"],
      ["product-studio", "Brain in a Vat Product Studio"],
      ["kickoff", "Music promo campaign kickoff"],
      ["pitching", "Music promo campaign pitching"],
      ["reporting", "Music promo campaign reporting"],
      ["real-estate", "Real-estate deal tracker"],
      ["touring", "Tour advancing system"],
      ["dubs", "Dubs"],
      ["writ", "Writ"],
      ["yoohoo", "Yoohoo"],
    ]);
  });

  it("derives the eight Whats from the canonical record structures", () => {
    expect(portfolioWhatNodes.map(({ id }) => id)).toEqual([
      "kickoff",
      "pitching",
      "reporting",
      "real-estate",
      "touring",
      "dubs",
      "writ",
      "yoohoo",
    ]);
    expect(portfolioWhatNodes.every(({ outlineType }) => outlineType === "what")).toBe(
      true,
    );
  });

  it("keeps the four Whys and their exact outline-v5 memberships", () => {
    expect(portfolioThreads.map(({ id, title, members }) => ({ id, title, members }))).toEqual([
      {
        id: "making-work-playable",
        title: "Making work playable",
        members: [
          "kickoff",
          "pitching",
          "reporting",
          "real-estate",
          "touring",
          "dubs",
          "writ",
          "yoohoo",
        ],
      },
      {
        id: "from-argument-to-instrument",
        title: "From argument to instrument",
        members: [
          "thread-philosophy",
          "thread-making-work-playable",
          "thread-authorship",
        ],
      },
      {
        id: "authorship",
        title: "Authorship",
        members: [
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
          "yoohoo",
        ],
      },
      {
        id: "philosophy",
        title: "Philosophy",
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
      ["product-studio", "yoohoo"],
      ["kickoff", "pitching"],
      ["pitching", "reporting"],
    ]);
  });

  it("keeps Bradley disconnected at rest and reveals four Why lines on selection", () => {
    const resting = getVisibleWorldLinks({ selectedId: null });
    expect(resting.some(({ from, to }) => from === "bradley" || to === "bradley")).toBe(false);

    const selected = getVisibleWorldLinks({ selectedId: "bradley" });
    expect(
      selected
        .filter(({ layer }) => layer === "story-root")
        .map(({ to }) => to),
    ).toEqual([
      "thread-making-work-playable",
      "thread-from-argument-to-instrument",
      "thread-authorship",
      "thread-philosophy",
    ]);
  });

  it("draws the arc's three Why memberships while retaining its factual-field focus", () => {
    const links = getVisibleWorldLinks({
      selectedId: "thread-from-argument-to-instrument",
    });

    expect(
      links.filter(
        ({ layer, threadId }) =>
          layer === "story-membership" &&
          threadId === "from-argument-to-instrument",
      ).map(({ to }) => to),
    ).toEqual([
      "thread-philosophy",
      "thread-making-work-playable",
      "thread-authorship",
    ]);
    expect(
      links.filter(({ layer }) => layer === "factual"),
    ).toHaveLength(portfolioWorldLinks.length);
  });

  it("keeps the factual field present while another Why is foregrounded", () => {
    const links = getVisibleWorldLinks({
      selectedId: "thread-authorship",
    });

    expect(links.filter(({ layer }) => layer === "factual")).toHaveLength(11);
  });

  it.each([
    [
      "bradley",
      [
        "story-root:bradley->thread-making-work-playable",
        "story-root:bradley->thread-from-argument-to-instrument",
        "story-root:bradley->thread-authorship",
        "story-root:bradley->thread-philosophy",
      ],
    ],
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
        "story-membership:thread-making-work-playable->yoohoo",
      ],
    ],
    [
      "thread-authorship",
      [
        "story-root:bradley->thread-authorship",
        "story-membership:thread-authorship->music-practice",
        "story-membership:thread-authorship->systems-consulting",
        "story-membership:thread-authorship->product-studio",
        "story-membership:thread-authorship->kickoff",
        "story-membership:thread-authorship->pitching",
        "story-membership:thread-authorship->reporting",
        "story-membership:thread-authorship->real-estate",
        "story-membership:thread-authorship->touring",
        "story-membership:thread-authorship->dubs",
        "story-membership:thread-authorship->writ",
        "story-membership:thread-authorship->yoohoo",
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

  it("activates the arc root, memberships, and complete factual field", () => {
    const selectedId = "thread-from-argument-to-instrument";
    const active = getVisibleWorldLinks({ selectedId }).filter((link) =>
      isWorldLinkActive(link, selectedId),
    );

    expect(active.filter(({ layer }) => layer === "factual")).toHaveLength(11);
    expect(
      active
        .filter(({ layer }) => layer !== "factual")
        .map(({ layer, from, to }) => `${layer}:${from}->${to}`),
    ).toEqual([
      "story-root:bradley->thread-from-argument-to-instrument",
      "story-membership:thread-from-argument-to-instrument->thread-philosophy",
      "story-membership:thread-from-argument-to-instrument->thread-making-work-playable",
      "story-membership:thread-from-argument-to-instrument->thread-authorship",
    ]);
  });

  it("keeps the complete factual field visible while the arc is open", () => {
    expect(
      getWorldFocusIds({
        activeThreadId: "from-argument-to-instrument",
        selectedId: "thread-from-argument-to-instrument",
      }),
    ).toEqual(new Set(portfolioWorldNodes.map(({ id }) => id)));
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
        id: "uncaptioned-video",
        status: "ready",
        purpose: "Show the interaction",
        format: "video",
        src: "/visuals/demo.mp4",
      }),
    ).toBe(false);
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
