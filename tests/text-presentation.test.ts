import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Characters that default to text but carry an emoji presentation. iOS paints
// the colour glyph for these unless U+FE0E follows, which is how a plain arrow
// in a link label turns into an emoji on a phone and nowhere else.
const EMOJI_CAPABLE = new Set(
  [
    [0x2194, 0x2199],
    [0x21a9, 0x21aa],
    [0x231a, 0x231b],
    [0x24c2, 0x24c2],
    [0x25aa, 0x25ab],
    [0x25b6, 0x25b6],
    [0x25c0, 0x25c0],
    [0x2600, 0x27bf],
    [0x2b05, 0x2b07],
    [0x2b1b, 0x2b1c],
    [0x2b50, 0x2b55],
    [0x3030, 0x3030],
    [0x303d, 0x303d],
    [0x3297, 0x3299],
  ].flatMap(([from, to]) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index),
  ),
);

const TEXT_PRESENTATION = 0xfe0e;

describe("user-facing text", () => {
  it("pins every emoji-capable character to its text glyph", () => {
    const files = globSync(["app/**/*.{ts,tsx,css}", "components/**/*.tsx", "content/**/*.json"], {
      exclude: (path) => path.includes(".test."),
    });
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (let index = 0; index < source.length; index += 1) {
        const codePoint = source.codePointAt(index);
        if (codePoint === undefined || !EMOJI_CAPABLE.has(codePoint)) continue;
        if (source.codePointAt(index + 1) === TEXT_PRESENTATION) continue;
        const line = source.slice(0, index).split("\n").length;
        offenders.push(
          `${file}:${line} U+${codePoint.toString(16).toUpperCase()} needs a U+FE0E suffix`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });
});
