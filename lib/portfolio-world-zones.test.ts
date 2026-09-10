import { describe, expect, it } from "vitest";
import {
  BAND_STAGGER,
  clearTrunkCone,
  createRng,
  ensureShift,
  groupByFamily,
  inSector,
  looseZones,
  placeInZone,
  polarPoint,
  screenAngle,
  screenDistance,
  starZones,
  MIN_SHIFT,
  stillRng,
  TRUNK_CONE,
  trunkTilt,
  ZONE_JITTER,
} from "./portfolio-world-zones";

const anchor = { x: 0, y: 0, z: 700 };

describe("zones", () => {
  it("maps screen angles onto world axes: right is -x, down is -y", () => {
    const right = polarPoint(anchor, 0, 100);
    expect(right.x).toBeCloseTo(-100);
    expect(right.y).toBeCloseTo(0);
    const down = polarPoint(anchor, 90, 100);
    expect(down.y).toBeCloseTo(-100);
    expect(screenAngle(anchor, down)).toBeCloseTo(90);
    expect(screenAngle(anchor, polarPoint(anchor, 200, 50))).toBeCloseTo(200);
  });

  it("recognises sectors that wrap past 360", () => {
    expect(inSector(10, [350, 380])).toBe(true);
    expect(inSector(355, [350, 380])).toBe(true);
    expect(inSector(30, [350, 380])).toBe(false);
  });

  it("gives members equal slots in list order, alternating near and far", () => {
    const zone = { sector: [100, 160] as const, band: [400, 600] as const, members: ["a", "b", "c"] };
    const placed = placeInZone(anchor, zone, stillRng);

    expect([...placed.keys()]).toEqual(["a", "b", "c"]);
    expect(screenAngle(anchor, placed.get("a")!)).toBeCloseTo(110);
    expect(screenAngle(anchor, placed.get("b")!)).toBeCloseTo(130);
    expect(screenAngle(anchor, placed.get("c")!)).toBeCloseTo(150);
    expect(screenDistance(anchor, placed.get("a")!)).toBeCloseTo(400 + 200 * BAND_STAGGER[0]);
    expect(screenDistance(anchor, placed.get("b")!)).toBeCloseTo(400 + 200 * BAND_STAGGER[1]);
  });

  it("keeps every seeded pose inside its slot and band, so order and grouping hold", () => {
    const zone = { sector: [100, 160] as const, band: [400, 600] as const, members: ["a", "b", "c"] };
    for (let seed = 0; seed < 200; seed += 1) {
      const placed = placeInZone(anchor, zone, createRng(seed));
      let previous = -Infinity;
      zone.members.forEach((id, index) => {
        const angle = screenAngle(anchor, placed.get(id)!);
        const centre = 110 + index * 20;
        expect(Math.abs(angle - centre)).toBeLessThanOrEqual(10 * ZONE_JITTER.angle + 1e-9);
        expect(angle).toBeGreaterThan(previous);
        previous = angle;
        const radius = screenDistance(anchor, placed.get(id)!);
        expect(radius).toBeGreaterThanOrEqual(400);
        expect(radius).toBeLessThanOrEqual(600);
      });
    }
  });

  it("is deterministic per seed", () => {
    const zone = { sector: [0, 90] as const, band: [100, 200] as const, members: ["a", "b"] };
    expect(placeInZone(anchor, zone, createRng(9))).toEqual(placeInZone(anchor, zone, createRng(9)));
    expect(placeInZone(anchor, zone, createRng(9))).not.toEqual(placeInZone(anchor, zone, createRng(10)));
  });

  it("seats a single relation on the right, and up to four in the accepted fan order", () => {
    expect(looseZones(["a"])[0].sector).toEqual([4, 24]);
    expect(looseZones(["a", "b", "c", "d"]).map((zone) => zone.members)).toEqual([
      ["a"],
      ["b"],
      ["c"],
      ["d"],
    ]);
  });

  it("rotates the fan's seating by a record's signature so siblings differ", () => {
    expect(looseZones(["a", "b", "c"], 1).map((zone) => zone.members)).toEqual([["b"], ["c"], ["a"]]);
    expect(looseZones(["a"], 3)[0].members).toEqual(["a"]);
  });

  it("groups star relations by family in a fixed order, keeping order within a family", () => {
    const family: Record<string, string> = { s: "story", c1: "component", c2: "component", p: "product" };
    expect(groupByFamily(["c1", "p", "s", "c2", "x"], (id) => family[id])).toEqual(["s", "c1", "c2", "p", "x"]);
  });

  it("widens the trunk cone for a wide label", () => {
    const bradley = polarPoint(anchor, 270, 900);
    const near = polarPoint(anchor, 250, 500);
    expect(clearTrunkCone(anchor, bradley, near)).toEqual(near);
    const cleared = clearTrunkCone(anchor, bradley, near, 200);
    expect(screenAngle(anchor, cleared)).toBeLessThan(250);
    expect(screenDistance(anchor, cleared)).toBeCloseTo(500);
  });

  it("splits a star across the right and left arcs, first half right", () => {
    const [right, left] = starZones(["a", "b", "c", "d", "e"]);
    expect(right.members).toEqual(["a", "b", "c"]);
    expect(left.members).toEqual(["d", "e"]);
    expect(starZones(["a"])).toHaveLength(1);
  });

  it("splits a grouped star at the family boundary nearest the middle", () => {
    const family: Record<string, string> = { s: "story", o: "operation", c1: "component", c2: "component", c3: "component" };
    const [right, left] = starZones(["s", "o", "c1", "c2", "c3"], (id) => family[id]);
    expect(right.members).toEqual(["s", "o"]);
    expect(left.members).toEqual(["c1", "c2", "c3"]);
  });

  it("hangs the fan from the trunk, tilting its seats with it", () => {
    const [seat] = looseZones(["a"], 0, -20);
    expect(seat.sector).toEqual([4 - 20, 24 - 20]);
    expect(trunkTilt(anchor, polarPoint(anchor, 250, 500))).toBeCloseTo(-20);
    expect(trunkTilt(anchor, polarPoint(anchor, 290, 500))).toBeCloseTo(20);
  });

  it("moves a relation out of the trunk cone to the nearer edge, keeping its radius", () => {
    const bradley = polarPoint(anchor, 297, 900);
    const inside = polarPoint(anchor, 300, 500);
    const cleared = clearTrunkCone(anchor, bradley, inside);
    expect(screenAngle(anchor, cleared)).toBeCloseTo(297 + TRUNK_CONE);
    expect(screenDistance(anchor, cleared)).toBeCloseTo(500);

    const other = polarPoint(anchor, 290, 500);
    expect(screenAngle(anchor, clearTrunkCone(anchor, bradley, other))).toBeCloseTo(297 - TRUNK_CONE);

    const clear = polarPoint(anchor, 200, 500);
    expect(clearTrunkCone(anchor, bradley, clear)).toEqual(clear);
  });

  it("moves a node by at least the minimum shift between compositions", () => {
    const previous = { x: 100, y: 100, z: 700 };
    expect(ensureShift(undefined, previous)).toEqual(previous);
    const far = { x: 100 + MIN_SHIFT * 2, y: 100, z: 700 };
    expect(ensureShift(previous, far)).toEqual(far);
    const near = ensureShift(previous, { x: 110, y: 100, z: 650 });
    expect(near).toEqual({ x: 100 + MIN_SHIFT, y: 100, z: 650 });
    const same = ensureShift(previous, { ...previous }, MIN_SHIFT, { x: -1, y: 0 });
    expect(same.x).toBeCloseTo(100 - MIN_SHIFT);
  });
});
