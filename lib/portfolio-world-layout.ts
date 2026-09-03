import { projectWorldPoint, type Point3, type ProjectedPoint } from "./portfolio-world-projection";

export type LayoutBox = { x: number; y: number; width: number; height: number };

export type RelaxNode = {
  id: string;
  label: string;
  pinned: boolean;
  /**
   * A node that gives way: against a non-yielding node it takes the whole
   * push, so a dimmed record steps out from under a spotlighted one rather
   * than nudging it.
   */
  yielding?: boolean;
};

export type RelaxOptions<Node extends RelaxNode> = {
  /** Starting world position per node id; mutated in place and returned. */
  positions: Map<string, Point3>;
  nodes: readonly Node[];
  camera: { position: Point3; target: Point3; fov: number };
  viewport: { width: number; height: number };
  /** Text measurement, injected so this stays pure and testable. */
  measure: (value: string) => number;
  wrap: (label: string, measure: (value: string) => number) => string[];
  lineHeight: number;
  iterations: number;
  /** Extra separation forced between two footprints, in screen pixels. */
  padding: number;
  /** Minimum half-width of a label footprint, in screen pixels. */
  minHalfWidth: number;
  footprint: { top: number; extraHeight: number };
  margins: { left: number; right: number; top: number; bottom: number };
  bounds: { x: number; y: number; z: [number, number] };
};

/**
 * Push node labels apart until their footprints stop overlapping, then clamp
 * them inside the viewport.
 *
 * This existed twice — once as a closure inside PortfolioWorld's mount effect
 * and once inside applyStoryGoals — as two ~110-line copies of the same
 * algorithm that differed only in constants, and those constants had drifted:
 * 120 iterations against 160, padding 5 against 8, different half-width floors,
 * footprint origins, world clamps and screen margins. One skipped pinned-versus-
 * pinned pairs and the other did not, which reads as drift rather than intent.
 * Neither copy was reachable from a test.
 *
 * The invariant is the thing worth asserting: after this runs, no two unpinned
 * footprints overlap and every footprint is inside the margins — or the
 * iteration budget ran out, which the return value reports.
 */
export function relaxWorldOverlaps<Node extends RelaxNode>({
  positions,
  nodes,
  camera,
  viewport,
  measure,
  wrap,
  lineHeight,
  iterations,
  padding,
  minHalfWidth,
  footprint,
  margins,
  bounds,
}: RelaxOptions<Node>): { settled: boolean; iterationsUsed: number } {
  const { width, height } = viewport;
  const pinnedById = new Map(nodes.map((node) => [node.id, node.pinned]));

  const project = () =>
    new Map(
      nodes.map((node) => {
        const point = positions.get(node.id)!;
        const projected = projectWorldPoint(
          point,
          camera.position,
          camera.target,
          camera.fov,
          width,
          height,
        )!;
        const lines = wrap(node.label, measure);
        const labelWidth = Math.ceil(Math.max(...lines.map(measure)));
        const halfWidth = Math.max(minHalfWidth, labelWidth / 2);
        return [
          node.id,
          {
            ...projected,
            footprint: {
              x: projected.x - halfWidth,
              y: projected.y - footprint.top,
              width: halfWidth * 2,
              height: footprint.extraHeight + lines.length * lineHeight,
            } satisfies LayoutBox,
          },
        ] as const;
      }),
    );

  const push = (
    id: string,
    dx: number,
    dy: number,
    projected: ProjectedPoint & { right: Point3; up: Point3 },
  ) => {
    if (pinnedById.get(id)) return;
    const point = positions.get(id)!;
    const inverseScale = 1 / Math.max(0.18, projected.scale);
    point.x += projected.right.x * dx * inverseScale - projected.up.x * dy * inverseScale;
    point.y += projected.right.y * dx * inverseScale - projected.up.y * dy * inverseScale;
    point.z += projected.right.z * dx * inverseScale - projected.up.z * dy * inverseScale;
    point.x = Math.max(-bounds.x, Math.min(bounds.x, point.x));
    point.y = Math.max(-bounds.y, Math.min(bounds.y, point.y));
    point.z = Math.max(bounds.z[0], Math.min(bounds.z[1], point.z));
  };

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const projected = project();
    let moved = false;

    for (let aIndex = 0; aIndex < nodes.length; aIndex += 1) {
      for (let bIndex = aIndex + 1; bIndex < nodes.length; bIndex += 1) {
        const aNode = nodes[aIndex]!;
        const bNode = nodes[bIndex]!;
        if (aNode.pinned && bNode.pinned) continue;
        const a = projected.get(aNode.id)!;
        const b = projected.get(bNode.id)!;
        const overlapX =
          Math.min(a.footprint.x + a.footprint.width, b.footprint.x + b.footprint.width) -
          Math.max(a.footprint.x, b.footprint.x) +
          padding;
        const overlapY =
          Math.min(a.footprint.y + a.footprint.height, b.footprint.y + b.footprint.height) -
          Math.max(a.footprint.y, b.footprint.y) +
          padding;
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        const aYields = Boolean(aNode.yielding) && !bNode.yielding;
        const bYields = Boolean(bNode.yielding) && !aNode.yielding;
        const aShare = aNode.pinned ? 0 : bNode.pinned ? 1 : aYields ? 1 : bYields ? 0 : 0.5;
        const bShare = 1 - aShare;
        if (overlapX < overlapY) {
          const direction = b.x >= a.x ? 1 : -1;
          push(aNode.id, -direction * overlapX * aShare, 0, a);
          push(bNode.id, direction * overlapX * bShare, 0, b);
        } else {
          const direction = b.y >= a.y ? 1 : -1;
          push(aNode.id, 0, -direction * overlapY * aShare, a);
          push(bNode.id, 0, direction * overlapY * bShare, b);
        }
      }
    }

    for (const node of nodes) {
      const projectedNode = projected.get(node.id)!;
      const box = projectedNode.footprint;
      if (box.x < margins.left) {
        push(node.id, margins.left - box.x, 0, projectedNode);
        moved = true;
      }
      if (box.x + box.width > width - margins.right) {
        push(node.id, width - margins.right - box.x - box.width, 0, projectedNode);
        moved = true;
      }
      if (box.y < margins.top) {
        push(node.id, 0, margins.top - box.y, projectedNode);
        moved = true;
      }
      if (box.y + box.height > height - margins.bottom) {
        push(node.id, 0, height - margins.bottom - box.y - box.height, projectedNode);
        moved = true;
      }
    }

    if (!moved) return { settled: true, iterationsUsed: iteration + 1 };
  }

  return { settled: false, iterationsUsed: iterations };
}
