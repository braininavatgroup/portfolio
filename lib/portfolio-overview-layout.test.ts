import { setWorldSeed } from "./portfolio-world-zones";
import { portfolioWorldNodes } from "./portfolio-world";
import { describe, expect, it } from "vitest";
import { portfolioOverviewLabel, portfolioOverviewPositions, portfolioOverviewNodeLabel, overviewConnectorSegments } from "./portfolio-overview-layout";

describe("portfolio overview", () => {
  it.each([1, 7, 42].flatMap(seed => [[320, 230, seed], [393, 285, seed], [700, 460, seed], [1200, 800, seed], [720, 1360, seed]]))("keeps every record in a distinct readable seat at %i by %i, seed %i", (width, height, seed) => {
    setWorldSeed(seed);
    const ids = portfolioWorldNodes.filter(node => node.id !== "bradley" && node.family !== "story").map(node => node.id);
    const compact = width < 600;
    const layout = portfolioOverviewPositions(portfolioWorldNodes, { width, height }, undefined, compact);
    expect(layout.positions.size).toBe(14);
    if (height >= 460) {
      const ys = [...layout.positions.values()].map(point => point.y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(height * 0.7);
    }
    expect(new Set(ids.map(id => Math.round(layout.positions.get(id)!.x))).size).toBeGreaterThan(6);
    const records = ids.map(id => layout.positions.get(id)!);
    if (height > width && width >= 600) {
      const bands = [0, 0, 0, 0];
      for (const point of layout.positions.values()) bands[Math.min(3, Math.floor(point.y / height * 4))]++;
      expect(bands.every(count => count >= 2), "tall graph leaves an empty horizontal band").toBe(true);
    }
    for (const [id, point] of layout.positions) {
      const label = portfolioOverviewNodeLabel(portfolioWorldNodes.find(node => node.id === id)!.label);
      const measure = (text: string) => text.length * 6.2 * (compact ? 11 / 12.5 : 1);
      const actualWidth = Math.max(...portfolioOverviewLabel(label, measure, layout.labelWidth).map(measure));
      expect(point.x).toBeGreaterThanOrEqual(12);
      expect(point.y).toBeGreaterThanOrEqual(12);
      expect(point.x + actualWidth / 2).toBeLessThanOrEqual(width);
      expect(point.y + 12).toBeLessThan(height);
    }
    const boxes = portfolioWorldNodes.map(node => {
      const measure = (text: string) => text.length * 6.2 * (compact ? 11 / 12.5 : 1);
      const lines = node.id === "bradley" ? [node.label] : portfolioOverviewLabel(portfolioOverviewNodeLabel(node.label), measure, layout.labelWidth);
      const point = layout.positions.get(node.id)!;
      const labelWidth = Math.max(...lines.map(measure));
      return { id: node.id, left: point.x - labelWidth / 2, right: point.x + labelWidth / 2, top: point.y + 18, bottom: point.y + 18 + lines.length * (compact ? 12 : 15) };
    });
    for (const [index, a] of boxes.entries()) {
      for (const b of boxes.slice(index + 1)) {
        const overlap = Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
    for (const [index, a] of records.entries()) {
      for (const b of records.slice(index + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(26);
    }
  });
});

it.each([
  ["kickoff", "Kickoff"],
  ["pitching", "Pitching"],
  ["reporting", "Reporting"],
])("keeps the canonical %s title distinct in the narrow mobile overview", (id, workflow) => {
  const node = portfolioWorldNodes.find(node => node.id === id)!;
  expect(node.label).toBe(`Music Promo Campaign ${workflow}`);
  const label = portfolioOverviewNodeLabel(node.label);
  expect(label).toBe(`Campaign ${workflow}`);
  expect(portfolioOverviewLabel(label, text => text.length * 6.2, 64)).toEqual([
    "Campaign", workflow,
  ]);
  expect(node.label).toBe(`Music Promo Campaign ${workflow}`);
});

it("bounds long overview labels to two lines without crossing into the adjacent labels", () => {
  const lines = portfolioOverviewLabel("Music Promotions Agency", value => value.length * 6, 70);
  expect(lines.length).toBeLessThanOrEqual(2);
  expect(lines.every(line => line.length * 6 <= 70)).toBe(true);
  expect(lines.join(" ")).toContain("…");
});

it("keeps overview webs straight and two pixels clear of intervening label lines", () => {
  const label = { x: 40, y: 30, width: 30, height: 20 };
  const segments = overviewConnectorSegments({ x: 0, y: 40 }, { x: 120, y: 40 }, [label]);
  // Only the ends the label cut fade; the ends where the line really stops
  // stay flat, so a connector never appears to begin in midair.
  expect(segments).toEqual([
    { start: { x: 0, y: 40 }, end: { x: 38, y: 40 }, fadeStart: false, fadeEnd: true },
    { start: { x: 72, y: 40 }, end: { x: 120, y: 40 }, fadeStart: true, fadeEnd: false },
  ]);
  expect(overviewConnectorSegments({ x: 0, y: 0 }, { x: 120, y: 0 }, [label])).toEqual([
    { start: { x: 0, y: 0 }, end: { x: 120, y: 0 }, fadeStart: false, fadeEnd: false },
  ]);
  expect(overviewConnectorSegments({ x: 45, y: 35 }, { x: 60, y: 45 }, [label])).toEqual([]);
});

it("gives wide overview fields a seeded pose instead of a fixed authored arrangement", () => {
  setWorldSeed(1);
  const a = portfolioOverviewPositions(portfolioWorldNodes, {width:1000,height:600});
  setWorldSeed(7);
  const b = portfolioOverviewPositions(portfolioWorldNodes, {width:1000,height:600});
  const moved = portfolioWorldNodes.filter(n=>n.id!=="bradley" && Math.hypot(a.positions.get(n.id)!.x-b.positions.get(n.id)!.x,a.positions.get(n.id)!.y-b.positions.get(n.id)!.y)>5);
  expect(moved.length).toBeGreaterThan(6);
  setWorldSeed(1);
  expect(portfolioOverviewPositions(portfolioWorldNodes,{width:1000,height:600}).positions).toEqual(a.positions);
});
