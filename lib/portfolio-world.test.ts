import { describe, expect, it } from "vitest";
import {
  getVisibleWorldLinks,
  portfolioStories,
  portfolioWorldLinks,
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
        members: ["kickoff", "pitching", "reporting", "personal-os", "yoohoo"],
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

  it("does not connect Good Morning to Choosing what not to automate", () => {
    const links = getVisibleWorldLinks({
      activeStoryId: "choosing-what-not-to-automate",
      selectedId: "story-choosing-what-not-to-automate",
    });

    expect(
      links.some(
        ({ from, to, storyId }) =>
          from === "story-choosing-what-not-to-automate" &&
          to === "alarm" &&
          storyId === "choosing-what-not-to-automate",
      ),
    ).toBe(false);
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

  it("uses the factual field instead of redundant membership spokes for Finding", () => {
    const links = getVisibleWorldLinks({
      activeStoryId: "finding-myself-in-software",
      selectedId: "story-finding-myself-in-software",
    });

    expect(
      links.filter(
        ({ layer, storyId }) =>
          layer === "story-membership" &&
          storyId === "finding-myself-in-software",
      ),
    ).toHaveLength(0);
    expect(
      links.filter(({ layer }) => layer === "factual"),
    ).toHaveLength(portfolioWorldLinks.length);
  });
});
