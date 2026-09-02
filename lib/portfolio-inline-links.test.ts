import { describe, expect, it } from "vitest";
import {
  inlineLinkTargets,
  parseInlineLinks,
  stripInlineLinks,
} from "./portfolio-inline-links";

describe("inline links", () => {
  const text = "I run a [music promotions agency](record:music-practice) and read [Philosophy](thread:philosophy).";

  it("splits a paragraph into text and link segments", () => {
    expect(parseInlineLinks(text)).toEqual([
      { type: "text", text: "I run a " },
      { type: "link", text: "music promotions agency", target: { kind: "record", id: "music-practice" } },
      { type: "text", text: " and read " },
      { type: "link", text: "Philosophy", target: { kind: "thread", id: "philosophy" } },
      { type: "text", text: "." },
    ]);
  });

  it("returns plain text untouched as one segment", () => {
    expect(parseInlineLinks("No links here.")).toEqual([{ type: "text", text: "No links here." }]);
    expect(parseInlineLinks("")).toEqual([]);
  });

  it("leaves markdown-looking text that is not a record or thread link alone", () => {
    const other = "See [the docs](https://example.com) and [x](note:1).";
    expect(parseInlineLinks(other)).toEqual([{ type: "text", text: other }]);
  });

  it("strips the markup for plain-text consumers", () => {
    expect(stripInlineLinks(text)).toBe(
      "I run a music promotions agency and read Philosophy.",
    );
  });

  it("lists every target", () => {
    expect(inlineLinkTargets(text)).toEqual([
      { kind: "record", id: "music-practice" },
      { kind: "thread", id: "philosophy" },
    ]);
  });
});
