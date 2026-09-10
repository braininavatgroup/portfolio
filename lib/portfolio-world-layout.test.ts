import { describe, expect, it } from "vitest";
import { relaxWorldOverlaps, type RelaxNode } from "./portfolio-world-layout";
import { projectWorldPoint, type Point3 } from "./portfolio-world-projection";

const camera = {
  position: { x: 0, y: 0, z: -520 } satisfies Point3,
  target: { x: 0, y: 0, z: 640 } satisfies Point3,
  fov: 720,
};
const viewport = { width: 1200, height: 800 };
const measure = (value: string) => value.length * 6.2;
const wrap = (label: string) => [label];

function options(nodes: RelaxNode[], positions: Map<string, Point3>) {
  return {
    positions,
    nodes,
    camera,
    viewport,
    measure,
    wrap,
    lineHeight: 14,
    iterations: 160,
    padding: 5,
    minHalfWidth: 13,
    footprint: { top: 13, extraHeight: 31 },
    margins: { left: 12, right: 12, top: 18, bottom: 78 },
    bounds: { x: 940, y: 540, z: [480, 1120] as [number, number] },
  };
}

function footprints(nodes: RelaxNode[], positions: Map<string, Point3>) {
  return nodes.map((node) => {
    const projected = projectWorldPoint(
      positions.get(node.id)!,
      camera.position,
      camera.target,
      camera.fov,
      viewport.width,
      viewport.height,
    )!;
    const halfWidth = Math.max(13, Math.ceil(measure(node.label)) / 2);
    return {
      id: node.id,
      x: projected.x - halfWidth,
      y: projected.y - 13,
      width: halfWidth * 2,
      height: 31 + 14,
    };
  });
}

function overlaps(a: ReturnType<typeof footprints>[number], b: typeof a) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/**
 * The invariant the two hand-written copies of this solver never had a test
 * for: after relaxing, no two footprints overlap. Neither copy was reachable —
 * one was a closure inside a mount effect, the other module-private — so the
 * only assertion in reach checked the solver's *input* rather than its output.
 */
describe("relaxWorldOverlaps", () => {
  it("separates footprints that start stacked on one another", () => {
    const nodes: RelaxNode[] = [
      { id: "a", label: "Reporting", pinned: false },
      { id: "b", label: "Kickoff", pinned: false },
      { id: "c", label: "Pitching", pinned: false },
    ];
    const positions = new Map<string, Point3>(
      nodes.map((node) => [node.id, { x: 0, y: 0, z: 700 }]),
    );

    expect(
      footprints(nodes, positions).some((a, i) =>
        footprints(nodes, positions).slice(i + 1).some((b) => overlaps(a, b)),
      ),
    ).toBe(true);

    relaxWorldOverlaps(options(nodes, positions));

    const after = footprints(nodes, positions);
    for (let i = 0; i < after.length; i += 1) {
      for (let j = i + 1; j < after.length; j += 1) {
        expect(overlaps(after[i]!, after[j]!), `${after[i]!.id} still overlaps ${after[j]!.id}`).toBe(false);
      }
    }
  });

  it("moves a yielding node out from under a spotlighted one, not the reverse", () => {
    const nodes: RelaxNode[] = [
      { id: "lit", label: "Spotlighted", pinned: false },
      { id: "dim", label: "Dimmed", pinned: false, yielding: true },
    ];
    const positions = new Map<string, Point3>([
      ["lit", { x: 0, y: 0, z: 640 }],
      ["dim", { x: 4, y: 2, z: 640 }],
    ]);

    relaxWorldOverlaps(options(nodes, positions));

    expect(positions.get("lit")).toEqual({ x: 0, y: 0, z: 640 });
    const boxes = footprints(nodes, positions);
    expect(overlaps(boxes[0], boxes[1])).toBe(false);
  });

  it("never moves a pinned node", () => {
    const nodes: RelaxNode[] = [
      { id: "bradley", label: "Bradley Berkman", pinned: true },
      { id: "other", label: "Reporting", pinned: false },
    ];
    const positions = new Map<string, Point3>([
      ["bradley", { x: 0, y: 0, z: 700 }],
      ["other", { x: 0, y: 0, z: 700 }],
    ]);

    relaxWorldOverlaps(options(nodes, positions));

    expect(positions.get("bradley")).toEqual({ x: 0, y: 0, z: 700 });
    expect(positions.get("other")).not.toEqual({ x: 0, y: 0, z: 700 });
  });

  it("reports settling rather than silently exhausting its budget", () => {
    const nodes: RelaxNode[] = [
      { id: "a", label: "One", pinned: false },
      { id: "b", label: "Two", pinned: false },
    ];
    const positions = new Map<string, Point3>([
      ["a", { x: -400, y: 200, z: 700 }],
      ["b", { x: 400, y: -200, z: 700 }],
    ]);

    const result = relaxWorldOverlaps(options(nodes, positions));

    expect(result.settled).toBe(true);
    expect(result.iterationsUsed).toBeLessThan(160);
  });

  it("keeps every footprint inside the viewport margins", () => {
    const nodes: RelaxNode[] = [
      { id: "a", label: "Systems consulting practice", pinned: false },
      { id: "b", label: "Music promotions systems", pinned: false },
    ];
    const positions = new Map<string, Point3>([
      ["a", { x: -930, y: 530, z: 700 }],
      ["b", { x: 930, y: -530, z: 700 }],
    ]);

    relaxWorldOverlaps(options(nodes, positions));

    for (const box of footprints(nodes, positions)) {
      expect(box.x, `${box.id} left`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${box.id} right`).toBeLessThanOrEqual(viewport.width);
    }
  });
});
