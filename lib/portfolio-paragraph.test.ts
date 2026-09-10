import { describe, expect, it } from "vitest";
import { paragraphHasList, parseParagraphFlow } from "./portfolio-paragraph";

describe("paragraph flow", () => {
  it("treats a paragraph without list lines as one prose run", () => {
    expect(parseParagraphFlow("Just prose.\nOn two lines.")).toEqual([
      { type: "prose", text: "Just prose.\nOn two lines." },
    ]);
    expect(paragraphHasList("Just prose.")).toBe(false);
  });

  it("splits a lead-in, a bulleted list, and a follow-on into runs", () => {
    const text =
      "A suite of services that include:\n- Playlist promotion\n- Radio plugging\n-  Press campaigns \nRegardless of the service, one process.";
    expect(parseParagraphFlow(text)).toEqual([
      { type: "prose", text: "A suite of services that include:" },
      { type: "list", items: ["Playlist promotion", "Radio plugging", "Press campaigns"] },
      { type: "prose", text: "Regardless of the service, one process." },
    ]);
    expect(paragraphHasList(text)).toBe(true);
  });

  it("ignores a dash that is not a list marker", () => {
    expect(parseParagraphFlow("Albums - tours - narratives.\n-not a list")).toEqual([
      { type: "prose", text: "Albums - tours - narratives.\n-not a list" },
    ]);
  });

  it("drops empty runs", () => {
    expect(parseParagraphFlow("")).toEqual([]);
    expect(parseParagraphFlow("- One\n\n- Two")).toEqual([
      { type: "list", items: ["One"] },
      { type: "list", items: ["Two"] },
    ]);
  });
});
