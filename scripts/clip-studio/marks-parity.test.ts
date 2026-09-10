import { describe, expect, it } from "vitest";
import {
  PORTFOLIO_NODE_MARK_SIZE,
  PORTFOLIO_NODE_MARK_STROKE,
  portfolioNodeMarkPrimitives,
} from "../../lib/portfolio-node-mark";
import { PORTFOLIO_GLYPH } from "../../lib/portfolio-glyph-metrics";
import type { PortfolioWorldFamily } from "../../lib/portfolio-world";
import {
  artworkScale,
  markPrimitives,
  markSize,
  markStroke,
} from "./public/marks.mjs";

const families: PortfolioWorldFamily[] = [
  "identity",
  "story",
  "operation",
  "component",
  "engagement",
  "product",
];

/**
 * The clip studio draws the map's node marks from its own plain-module port,
 * because the page runs outside the application build. These assertions are
 * what keeps the port honest: change a mark on the map and this fails.
 */
describe("clip studio node marks match the portfolio's", () => {
  it("uses the map's size and stroke", () => {
    expect(markSize).toBe(PORTFOLIO_NODE_MARK_SIZE);
    expect(markStroke).toBe(PORTFOLIO_NODE_MARK_STROKE);
    expect(artworkScale).toBe(PORTFOLIO_GLYPH.artworkScale);
  });

  for (const family of families) {
    it(`draws ${family} with the same primitives`, () => {
      expect(markPrimitives(family, PORTFOLIO_NODE_MARK_SIZE)).toEqual(
        portfolioNodeMarkPrimitives(family, PORTFOLIO_NODE_MARK_SIZE),
      );
    });
  }
});
