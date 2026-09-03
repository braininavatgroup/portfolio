import { describe, expect, it } from "vitest";
import {
  closestPair,
  compositionRegion,
  FIELD,
  fieldBounds,
  fieldCandidates,
  fieldScreenTargets,
  isBlocked,
  segmentDistance,
  segmentRectClearanceShift,
  segmentRectDistance,
  spreadSeats,
} from "./portfolio-world-field";
import { createRng } from "./portfolio-world-zones";

const viewport = { width: 893, height: 900 };

describe("field", () => {
  it("measures distance to a segment, not its line", () => {
    const segment = [{ x: 0, y: 0 }, { x: 100, y: 0 }] as const;
    expect(segmentDistance({ x: 50, y: 10 }, segment)).toBe(10);
    expect(segmentDistance({ x: 200, y: 0 }, segment)).toBe(100);
  });

  it("measures a segment against a box, zero when they cross", () => {
    const box = { left: 100, top: 100, right: 200, bottom: 150 };
    expect(segmentRectDistance([{ x: 0, y: 125 }, { x: 300, y: 125 }], box)).toBe(0);
    expect(segmentRectDistance([{ x: 120, y: 120 }, { x: 300, y: 300 }], box)).toBe(0);
    expect(segmentRectDistance([{ x: 0, y: 170 }, { x: 300, y: 170 }], box)).toBe(20);
    expect(segmentRectDistance([{ x: 230, y: 0 }, { x: 230, y: 300 }], box)).toBe(30);
  });

  it("nudges a label sideways when a non-incident lit line brushes its text", () => {
    const line = [{ x: 250, y: 211 }, { x: 346, y: 289 }] as const;
    const box = { left: 151, top: 198, right: 264, bottom: 213 };

    const shift = segmentRectClearanceShift(line, box, 8);
    const shifted = {
      left: box.left + shift.x,
      top: box.top + shift.y,
      right: box.right + shift.x,
      bottom: box.bottom + shift.y,
    };

    expect(shift.x).toBeLessThan(0);
    expect(shift.y).toBe(0);
    expect(segmentRectDistance(line, shifted)).toBeGreaterThanOrEqual(8 - 1e-3);
  });

  it("blocks the room around a lit node's label and along a lit line", () => {
    const lit = [{ point: { x: 400, y: 400 }, halfWidth: 50 }];
    expect(isBlocked({ x: 400, y: 440 }, lit, [])).toBe(true);
    expect(isBlocked({ x: 400 + 50 + FIELD.label.halfWidth + FIELD.clearance.x + 1, y: 400 }, lit, [])).toBe(false);
    expect(isBlocked({ x: 400 + 50 + FIELD.label.halfWidth + FIELD.clearance.x - 1, y: 400 }, lit, [])).toBe(true);
    expect(isBlocked({ x: 400, y: 400 + FIELD.clearance.below + 1 }, lit, [])).toBe(false);
    expect(isBlocked({ x: 400, y: 400 - FIELD.clearance.above - 1 }, lit, [])).toBe(false);
    const line = [{ x: 0, y: 100 }, { x: 800, y: 100 }] as const;
    const reach = FIELD.markReach + FIELD.lineClearance;
    expect(isBlocked({ x: 300, y: 100 + reach - 1 }, [], [line])).toBe(true);
    expect(isBlocked({ x: 300, y: 100 + reach + 1 }, [], [line])).toBe(false);
    // The hanging label must clear the line too, across its whole box.
    expect(isBlocked({ x: 300, y: 100 - FIELD.label.depth + 2 }, [], [line])).toBe(true);
    expect(isBlocked({ x: 300, y: 100 - FIELD.label.depth - FIELD.lineClearance - 2 }, [], [line])).toBe(false);
    const diagonal = [{ x: 200, y: 200 }, { x: 400, y: 0 }] as const;
    // A spoke through the middle of the label's bottom edge, well away from every probe point.
    expect(isBlocked({ x: 300, y: 100 - FIELD.label.depth + 4 }, [], [diagonal])).toBe(true);
  });

  it("lays candidates inside a region, more than the records need", () => {
    const region = fieldBounds(viewport);
    const candidates = fieldCandidates(region, 12, createRng(1));
    expect(candidates.length).toBeGreaterThanOrEqual(12 * FIELD.density * 0.7);
    for (const { x, y } of candidates) {
      expect(x).toBeGreaterThanOrEqual(region.left);
      expect(x).toBeLessThanOrEqual(region.right);
      expect(y).toBeGreaterThanOrEqual(region.top);
      expect(y).toBeLessThanOrEqual(region.bottom);
    }
  });

  it("takes the composition's footprint plus a margin, inside the bounds", () => {
    const bounds = fieldBounds(viewport);
    const lit = [
      { point: { x: 300, y: 200 }, halfWidth: 10 },
      { point: { x: 500, y: 600 }, halfWidth: 10 },
    ];
    expect(compositionRegion(lit, bounds)).toEqual({
      left: 300 - FIELD.margin,
      top: 200 - FIELD.margin,
      right: 500 + FIELD.margin,
      bottom: 600 + FIELD.margin,
    });
    expect(compositionRegion(lit, bounds, 1000)).toEqual(bounds);
    expect(compositionRegion([], bounds)).toEqual(bounds);
  });

  it("spreads seats by always taking the candidate farthest from those taken", () => {
    const candidates = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 0 },
    ];
    expect(spreadSeats(candidates, 3, () => 0)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 0 },
    ]);
    expect(spreadSeats([], 3)).toEqual([]);
  });

  it("seats every dimmed record clear of lit nodes and lines, evenly, inside the footprint when it has room", () => {
    const lit = [
      { point: { x: 446, y: 216 }, halfWidth: 60 },
      { point: { x: 400, y: 560 }, halfWidth: 70 },
      { point: { x: 200, y: 450 }, halfWidth: 50 },
      { point: { x: 650, y: 480 }, halfWidth: 50 },
    ];
    const lines = [
      [lit[0].point, lit[1].point],
      [lit[1].point, lit[2].point],
      [lit[1].point, lit[3].point],
    ] as const;
    const dimmed = Array.from({ length: 4 }, (_, index) => ({
      id: `d${index}`,
      rest: { x: 100 + index * 180, y: 800 },
    }));
    const targets = fieldScreenTargets(dimmed, lit, lines, viewport, createRng(2));

    expect(targets.size).toBe(4);
    const points = [...targets.values()];
    for (const point of points) expect(isBlocked(point, lit, lines)).toBe(false);
    // Two records fit in the footprint itself, so they stay inside it.
    const region = compositionRegion(lit, fieldBounds(viewport));
    const few = fieldScreenTargets(dimmed.slice(0, 2), lit, lines, viewport, createRng(2));
    for (const point of few.values()) {
      expect(point.x).toBeGreaterThanOrEqual(region.left);
      expect(point.x).toBeLessThanOrEqual(region.right);
      expect(point.y).toBeGreaterThanOrEqual(region.top);
      expect(point.y).toBeLessThanOrEqual(region.bottom);
    }
    let closest = Infinity;
    points.forEach((a, i) => points.slice(i + 1).forEach((b) => {
      closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
    }));
    expect(closest).toBeGreaterThanOrEqual(FIELD.spacing);
    // A record resting far left seats left of one resting far right.
    expect(targets.get("d0")!.x).toBeLessThan(targets.get("d3")!.x);
  });

  it("grows the region outward when the footprint has too little clear room", () => {
    const lit = [
      { point: { x: 440, y: 400 }, halfWidth: 60 },
      { point: { x: 460, y: 440 }, halfWidth: 60 },
    ];
    const dimmed = Array.from({ length: 12 }, (_, index) => ({ id: `d${index}`, rest: { x: 450, y: 420 } }));
    const targets = fieldScreenTargets(dimmed, lit, [], viewport, createRng(6));
    expect(targets.size).toBe(12);
    const tight = compositionRegion(lit, fieldBounds(viewport));
    const outside = [...targets.values()].filter(
      ({ x, y }) => x < tight.left || x > tight.right || y < tight.top || y > tight.bottom,
    );
    expect(outside.length).toBeGreaterThan(0);
    for (const point of targets.values()) expect(isBlocked(point, lit, [])).toBe(false);
    expect(closestPair([...targets.values()])).toBeGreaterThanOrEqual(FIELD.spacing);
  });

  it("is deterministic per seed and differs between seeds", () => {
    const dimmed = Array.from({ length: 6 }, (_, index) => ({ id: `d${index}`, rest: { x: 100 * index, y: 500 } }));
    expect(fieldScreenTargets(dimmed, [], [], viewport, createRng(3))).toEqual(
      fieldScreenTargets(dimmed, [], [], viewport, createRng(3)),
    );
    expect(fieldScreenTargets(dimmed, [], [], viewport, createRng(3))).not.toEqual(
      fieldScreenTargets(dimmed, [], [], viewport, createRng(4)),
    );
  });
});
