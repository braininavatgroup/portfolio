import { describe, expect, it } from "vitest";

import {
  layoutMacMenuBar,
  WRIT_MENU_BAR,
  type MacMenuBarItem,
  type MacMenuBarSpec,
} from "./mac-menu-bar";

const item = (id: string, width: number): MacMenuBarItem => ({
  id,
  src: `/${id}.png`,
  width,
  height: 30,
});

const spec: MacMenuBarSpec = {
  center: item("center", 20),
  left: [item("l1", 20), item("l2", 20), item("l3", 20)],
  right: [item("r1", 20), item("r2", 20), item("clock", 100)],
  minGap: 10,
  maxGap: 20,
  edgePadding: 10,
};

const sideWidth = (items: readonly MacMenuBarItem[], gap: number) =>
  items.reduce((total, entry) => total + entry.width + gap, 0);

describe("layoutMacMenuBar", () => {
  it("keeps every item at the widest spacing when the column is generous", () => {
    const layout = layoutMacMenuBar(spec, 1200);
    expect(layout.left.map((entry) => entry.id)).toEqual(["l1", "l2", "l3"]);
    expect(layout.right.map((entry) => entry.id)).toEqual(["r1", "r2", "clock"]);
    expect(layout.leftGap).toBe(spec.maxGap);
    expect(layout.rightGap).toBe(spec.maxGap);
  });

  it("tightens spacing before removing anything", () => {
    // Each side has 20 px of padding and 10 px of centre icon to give up.
    // Right side needs 140 + 3 * gap; at width 400 it has 400/2 - 10 - 10 = 180.
    const layout = layoutMacMenuBar(spec, 400);
    expect(layout.right.map((entry) => entry.id)).toEqual(["r1", "r2", "clock"]);
    expect(layout.left.map((entry) => entry.id)).toEqual(["l1", "l2", "l3"]);
    expect(layout.rightGap).toBeGreaterThanOrEqual(spec.minGap);
    expect(layout.rightGap).toBeLessThan(spec.maxGap);
    expect(sideWidth(layout.right, layout.rightGap)).toBeLessThanOrEqual(180 + 1e-9);
    // The lighter left side is not held to the right side's spacing.
    expect(layout.leftGap).toBe(spec.maxGap);
  });

  it("drops the leftmost item on screen first on each side", () => {
    // Right side at width 300 has 130 px: the clock alone fits at the minimum gap.
    const layout = layoutMacMenuBar(spec, 300);
    expect(layout.right.map((entry) => entry.id)).toEqual(["clock"]);
    // Left side has 130 px too: 3 items need 90 plus spacing, and the 70 px of
    // slack lets all three relax to the widest spacing, as does the clock alone.
    expect(layout.left.map((entry) => entry.id)).toEqual(["l1", "l2", "l3"]);
    expect(layout.leftGap).toBe(spec.maxGap);
    expect(layout.rightGap).toBe(spec.maxGap);
  });

  it("never lets a side overflow its half of the column", () => {
    for (const width of [0, 60, 120, 200, 320, 480, 640, 900]) {
      const layout = layoutMacMenuBar(spec, width);
      const available = Math.max(0, width / 2 - spec.center.width / 2 - spec.edgePadding);
      expect(sideWidth(layout.left, layout.leftGap)).toBeLessThanOrEqual(available + 1e-9);
      expect(sideWidth(layout.right, layout.rightGap)).toBeLessThanOrEqual(available + 1e-9);
    }
  });

  it("empties both sides rather than crashing in a column narrower than the centre icon", () => {
    const layout = layoutMacMenuBar(spec, 10);
    expect(layout.left).toEqual([]);
    expect(layout.right).toEqual([]);
  });

  it("keeps the Writ icon centred and the clock present in a typical reader column", () => {
    const layout = layoutMacMenuBar(WRIT_MENU_BAR, 560);
    expect(layout.right.at(-1)?.id).toBe("clock");
    expect(layout.left.length).toBeGreaterThan(0);
  });
});
