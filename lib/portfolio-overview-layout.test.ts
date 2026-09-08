import { describe, expect, it } from "vitest";
import { portfolioOverviewLabel, portfolioOverviewPositions } from "./portfolio-overview-layout";

describe("portfolio overview", () => {
  it.each([[320, 230], [393, 285], [700, 460], [1200, 800]])("keeps every record in a distinct readable seat at %i by %i", (width, height) => {
    const ids = Array.from({ length: 11 }, (_, i) => `record-${i}`);
    const layout = portfolioOverviewPositions([ids.slice(0, 4), ids.slice(4, 9), ids.slice(9)], ["theme-a", "theme-b"], { width, height });
    expect(layout.positions.size).toBe(14);
    const records = ids.map(id => layout.positions.get(id)!);
    for (const point of layout.positions.values()) {
      expect(point.x).toBeGreaterThanOrEqual(12);
      expect(point.y).toBeGreaterThanOrEqual(12);
      expect(point.x + layout.labelWidth + 12).toBeLessThanOrEqual(width);
      expect(point.y + 12).toBeLessThan(height);
    }
    for (const [index, a] of records.entries()) {
      for (const b of records.slice(index + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(26);
    }
  });
});

it("bounds long overview labels to two lines without crossing into the next column", () => {
  const lines = portfolioOverviewLabel("Music Promotions Agency", value => value.length * 6, 70);
  expect(lines.length).toBeLessThanOrEqual(2);
  expect(lines.every(line => line.length * 6 <= 70)).toBe(true);
  expect(lines.join(" ")).toContain("…");
});
