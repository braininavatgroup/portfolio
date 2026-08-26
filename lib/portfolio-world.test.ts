import { describe, expect, it } from "vitest";
import {
  getVisibleWorldLinks,
  portfolioStories,
  portfolioWorldNodes,
} from "./portfolio-world";

describe("accepted portfolio world", () => {
  it("keeps the authored world free of the discarded music node", () => {
    expect(portfolioWorldNodes.map(({ id }) => id)).toEqual([
      "bradley",
      "infamous",
      "music-practice",
      "systems-consulting",
      "kickoff",
      "pitching",
      "reporting",
      "real-estate",
      "touring",
      "personal-os",
      "dubs",
      "writ",
      "yoohoo",
      "alarm",
      "story-making-work-playable",
      "story-choosing-what-not-to-automate",
      "story-finding-myself-in-software",
    ]);
    expect(portfolioWorldNodes.some(({ id }) => id === "music")).toBe(false);
  });

  it("keeps the three editorial readings and their deliberate memberships", () => {
    expect(portfolioStories.map(({ title, members }) => ({ title, members }))).toEqual([
      {
        title: "Making work playable",
        members: ["personal-os", "dubs", "writ", "yoohoo", "alarm"],
      },
      {
        title: "Choosing what not to automate",
        members: ["kickoff", "pitching", "reporting", "personal-os", "yoohoo", "alarm"],
      },
      {
        title: "Finding myself in software",
        members: [
          "infamous",
          "music-practice",
          "systems-consulting",
          "kickoff",
          "pitching",
          "reporting",
          "personal-os",
          "real-estate",
          "touring",
          "dubs",
          "writ",
          "yoohoo",
          "alarm",
        ],
      },
    ]);
  });

  it("keeps Bradley disconnected at rest and reveals authorship on selection", () => {
    const resting = getVisibleWorldLinks({ activeStoryId: null, selectedId: null });
    expect(resting.some(({ from, to }) => from === "bradley" || to === "bradley")).toBe(false);

    const selected = getVisibleWorldLinks({ activeStoryId: null, selectedId: "bradley" });
    expect(
      selected
        .filter(({ layer }) => layer === "story-root")
        .map(({ to }) => to),
    ).toEqual([
      "story-making-work-playable",
      "story-choosing-what-not-to-automate",
      "story-finding-myself-in-software",
    ]);
  });
});
