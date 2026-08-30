import { describe, expect, it } from "vitest";
import {
  getVisibleWorldLinks,
  legacyProjectSlugRedirects,
  portfolioContact,
  portfolioThreads,
  portfolioThroughline,
  portfolioWorldLinks,
  portfolioWorldNodeById,
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
      "thread-making-work-playable",
      "thread-choosing-what-not-to-automate",
      "thread-finding-myself-in-software",
    ]);
    expect(portfolioWorldNodes.some(({ id }) => id === "music")).toBe(false);
  });

  it("keeps the three editorial threads and their deliberate memberships", () => {
    expect(portfolioThreads.map(({ title, members }) => ({ title, members }))).toEqual([
      {
        title: "Making work playable",
        members: ["personal-os", "dubs", "writ", "yoohoo", "alarm"],
      },
      {
        title: "Choosing what not to automate",
        members: ["kickoff", "pitching", "reporting", "personal-os", "yoohoo"],
      },
      {
        title: "From argument to instrument",
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
      activeThreadId: "choosing-what-not-to-automate",
      selectedId: "thread-choosing-what-not-to-automate",
    });

    expect(
      links.some(
        ({ from, to, threadId }) =>
          from === "thread-choosing-what-not-to-automate" &&
          to === "alarm" &&
          threadId === "choosing-what-not-to-automate",
      ),
    ).toBe(false);
  });

  it("keeps Bradley disconnected at rest and reveals authorship on selection", () => {
    const resting = getVisibleWorldLinks({ activeThreadId: null, selectedId: null });
    expect(resting.some(({ from, to }) => from === "bradley" || to === "bradley")).toBe(false);

    const selected = getVisibleWorldLinks({ activeThreadId: null, selectedId: "bradley" });
    expect(
      selected
        .filter(({ layer }) => layer === "story-root")
        .map(({ to }) => to),
    ).toEqual([
      "thread-making-work-playable",
      "thread-choosing-what-not-to-automate",
      "thread-finding-myself-in-software",
    ]);
  });

  it("uses the factual field instead of redundant membership spokes for Finding", () => {
    const links = getVisibleWorldLinks({
      activeThreadId: "finding-myself-in-software",
      selectedId: "thread-finding-myself-in-software",
    });

    expect(
      links.filter(
        ({ layer, threadId }) =>
          layer === "story-membership" &&
          threadId === "finding-myself-in-software",
      ),
    ).toHaveLength(0);
    expect(
      links.filter(({ layer }) => layer === "factual"),
    ).toHaveLength(portfolioWorldLinks.length);
  });
});

describe("authored content contract", () => {
  it("gives every node a complete record", () => {
    for (const node of portfolioWorldNodes) {
      expect(node.label).not.toBe("");
      expect(node.summary).not.toBe("");
      expect(node.body.length).toBeGreaterThan(0);
      expect(node.body.every((paragraph) => paragraph.length > 0)).toBe(true);
    }
  });

  it("keeps the public identity content in place", () => {
    expect(portfolioThroughline).not.toBe("");
    expect(portfolioContact.email).toBe("bradley@braininavat.dance");
    expect(portfolioContact.socials.map(({ label }) => label)).toEqual([
      "LinkedIn",
      "GitHub",
      "Instagram",
    ]);
  });

  it("redirects every legacy case-study slug to an existing node", () => {
    for (const target of Object.values(legacyProjectSlugRedirects)) {
      const node = portfolioWorldNodeById.get(target);
      expect(node).toBeDefined();
      expect(node?.family).not.toBe("story");
    }
  });
});
