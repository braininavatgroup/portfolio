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

  it("parses an external link and leaves other markdown-looking text alone", () => {
    const other = "See [the docs](https://example.com/a?b=1) and [x](note:1).";
    expect(parseInlineLinks(other)).toEqual([
      { type: "text", text: "See " },
      { type: "link", text: "the docs", target: { kind: "external", href: "https://example.com/a?b=1" } },
      { type: "text", text: " and [x](note:1)." },
    ]);
    expect(parseInlineLinks("[x](ftp://example.com) [y](javascript:alert(1))")).toEqual([
      { type: "text", text: "[x](ftp://example.com) [y](javascript:alert(1))" },
    ]);
  });

  it("strips the markup for plain-text consumers, keeping an external address", () => {
    expect(stripInlineLinks(text)).toBe(
      "I run a music promotions agency and read Philosophy.",
    );
    expect(stripInlineLinks("More at [braininavat.dance](https://braininavat.dance/).")).toBe(
      "More at braininavat.dance (https://braininavat.dance/).",
    );
  });

  it("lists every target", () => {
    expect(inlineLinkTargets(`${text} [site](https://example.com)`)).toEqual([
      { kind: "record", id: "music-practice" },
      { kind: "thread", id: "philosophy" },
      { kind: "external", href: "https://example.com" },
    ]);
  });
});
