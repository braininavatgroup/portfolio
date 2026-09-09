import { fieldCandidates } from "./portfolio-world-field";
import { compositionRng } from "./portfolio-world-zones";
import { relaxWorldOverlaps } from "./portfolio-world-layout";
import { projectWorldPoint, worldPointAtDepth } from "./portfolio-world-projection";
import type { PortfolioWorldNode } from "./portfolio-world";

export const portfolioOverviewNodeLabel = (label: string) => label
  .replace(/^Brain in a Vat /, "").replace(/^Music promo campaign /i, "Campaign ");

/** Fit the authored spatial graph to its actual slot, then use the same
 * overlap solver as selected compositions. Contents ordering is not geometry. */
export function portfolioOverviewPositions(
  nodes: readonly Pick<PortfolioWorldNode, "id" | "label" | "position">[],
  { width, height }: { width: number; height: number },
  measure: (text: string) => number = text => text.length * 6.2,
  compact = false,
) {
  const labelWidth = width < 400 ? 64 : Math.min(132, width * 0.24);
  const scale = compact ? 11 / 12.5 : 1;
  const identity = nodes.find(node => node.id === "bradley")?.label;
  const measured = (text: string) => measure(text) * (text === identity && !compact ? 14 / 12.5 : scale);
  const camera = { position: { x: 0, y: 0, z: -760 }, target: { x: 0, y: 0, z: 760 }, fov: 1300 };
  const xs = nodes.map(node => node.position.x);
  const ys = nodes.map(node => node.position.y);
  const left = labelWidth / 2 + 18;
  const right = width - left;
  const top = Math.min(40, height * 0.1);
  const bottom = height - (compact ? 40 : 54);
  const positions = new Map(nodes.map(node => {
    const x = left + (node.position.x - Math.min(...xs)) / Math.max(1, Math.max(...xs) - Math.min(...xs)) * (right - left);
    const y = top + (node.position.y - Math.min(...ys)) / Math.max(1, Math.max(...ys) - Math.min(...ys)) * (bottom - top);
    return [node.id, worldPointAtDepth({ x, y }, 1300, camera.position, camera.target, camera.fov, width, height)];
  }));
  // Use the same seeded field at every aspect ratio. Wider slots must not
  // switch back to a fixed authored arc. Separation keeps the loose pose readable.
  const candidates = fieldCandidates({ left, right, top, bottom }, nodes.length, compositionRng("overview"));
  const seated: { x: number; y: number }[] = [];
  const priority = (id: string) => id === "bradley" ? 1 : 0;
  for (const node of [...nodes].sort((a, b) => priority(b.id) - priority(a.id))) {
    const authored = projectWorldPoint(positions.get(node.id)!, camera.position, camera.target, camera.fov, width, height)!;
    const score = (point: { x: number; y: number }) => {
      const separation = seated.length ? Math.min(...seated.map(other => Math.hypot((point.x - other.x) / 1.3, point.y - other.y))) : 0;
      return separation - Math.hypot(point.x - authored.x, point.y - authored.y) * 0.08;
    };
    const seat = node.id === "bradley"
      ? authored
      : candidates.reduce((best, point) => score(point) > score(best) ? point : best);
    seated.push(seat);
    positions.set(node.id, worldPointAtDepth(seat, 1300, camera.position, camera.target, camera.fov, width, height));
  }
  relaxWorldOverlaps({
    positions,
    nodes: nodes.map(node => ({ id: node.id, label: portfolioOverviewNodeLabel(node.label), pinned: false })),
    camera, viewport: { width, height }, measure: measured,
    wrap: (label, measureText) => label === identity ? [label] : portfolioOverviewLabel(label, measureText, labelWidth),
    lineHeight: compact ? 12 : 15, iterations: 200, padding: 8, minHalfWidth: 12,
    footprint: { top: 12, extraHeight: 30 },
    margins: { left: 16, right: 16, top: 16, bottom: 16 },
    bounds: { x: 10000, y: 10000, z: [480, 1600] },
  });
  return {
    positions: new Map([...positions].map(([id, point]) => [id, projectWorldPoint(point, camera.position, camera.target, camera.fov, width, height)!])),
    labelWidth,
  };
}

/** At most two lines, each bounded by the available canvas space, with the full accessible
 * name retained on the node button. Long overview labels use an ellipsis. */
export function portfolioOverviewLabel(label: string, measure: (text: string) => number, width: number): string[] {
  if (measure(label) <= width) return [label];
  const words = label.split(" ");
  let first = words.shift() ?? "";
  while (words.length && measure(`${first} ${words[0]}`) <= width) first += ` ${words.shift()}`;
  const fit = (text: string) => {
    if (measure(text) <= width) return text;
    while (text.length > 1 && measure(`${text}…`) > width) text = text.slice(0, -1);
    return `${text.trimEnd()}…`;
  };
  return [fit(first), ...(words.length ? [fit(words.join(" "))] : [])];
}

export type OverviewConnectorSegment = {
  start: { x: number; y: number };
  end: { x: number; y: number };
  /** This end was cut by a label rather than being where the line really stops. */
  fadeStart: boolean;
  fadeEnd: boolean;
};

/** Keep the authored straight relationship, with a gap wherever an unrelated
 * label covers it. Dense overview webs cannot always move every label clear of
 * every edge; clipping preserves the full topology without drawing through text.
 * The cut ends are reported so the renderer can fade them out instead of
 * letting a line start in midair. */
export function overviewConnectorSegments(
  from: { x: number; y: number },
  to: { x: number; y: number },
  labels: readonly { x: number; y: number; width: number; height: number }[],
  clearance = 2,
): OverviewConnectorSegment[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const blocked: [number, number][] = [];
  for (const label of labels) {
    let start = 0;
    let end = 1;
    for (const [origin, direction, low, high] of [
      [from.x, dx, label.x - clearance, label.x + label.width + clearance],
      [from.y, dy, label.y - clearance, label.y + label.height + clearance],
    ]) {
      if (Math.abs(direction) < 1e-9) {
        if (origin < low || origin > high) { end = -1; break; }
      } else {
        const a = (low - origin) / direction;
        const b = (high - origin) / direction;
        start = Math.max(start, Math.min(a, b));
        end = Math.min(end, Math.max(a, b));
      }
    }
    if (end > start) blocked.push([start, end]);
  }
  blocked.sort((a, b) => a[0] - b[0]);
  const point = (t: number) => ({ x: from.x + dx * t, y: from.y + dy * t });
  const visible: OverviewConnectorSegment[] = [];
  let cursor = 0;
  for (const [start, end] of blocked) {
    if (start > cursor) {
      visible.push({
        start: point(cursor),
        end: point(start),
        fadeStart: cursor > 0,
        fadeEnd: true,
      });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < 1) {
    visible.push({
      start: point(cursor),
      end: to,
      fadeStart: cursor > 0,
      fadeEnd: false,
    });
  }
  return visible;
}
