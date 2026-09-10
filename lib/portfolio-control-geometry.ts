import { svgPathBbox } from "svg-path-bbox";
import type { PortfolioNodeMarkPrimitive } from "./portfolio-node-mark";

import { PORTFOLIO_GLYPH } from "./portfolio-glyph-metrics";
export const CONTROL_SURFACE_SIZE = PORTFOLIO_GLYPH.control.surface;
export const CONTROL_INK_SIZE = PORTFOLIO_GLYPH.control.ink;
export const CONTROL_STROKE = PORTFOLIO_GLYPH.control.stroke;

/** Test/authoring measurement only. Never imported by a runtime renderer.
 * Round joins/caps and non-scaling strokes bound ink to half a stroke outside
 * the path. The remaining pixel on every edge belongs to rasterization, not ink.
 */
export function controlGeometry(primitives: readonly PortfolioNodeMarkPrimitive[]) {
  const boxes = primitives.map(p => {
    if (p.kind === "path") return svgPathBbox(p.d);
    if (p.kind === "circle") return [p.x-p.radius,p.y-p.radius,p.x+p.radius,p.y+p.radius];
    if (p.kind === "polyline") return [Math.min(...p.points.map(q=>q.x)),Math.min(...p.points.map(q=>q.y)),Math.max(...p.points.map(q=>q.x)),Math.max(...p.points.map(q=>q.y))];
    throw new Error("Identity uses its canonical asset, not control geometry");
  });
  const bounds = [Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))] as const;
  const extent = Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1]);
  if (!Number.isFinite(extent) || extent <= 0) throw new Error("Control needs nonempty finite geometry");
  const scale = (CONTROL_INK_SIZE-CONTROL_STROKE)/extent;
  const x = -(bounds[0]+bounds[2])*scale/2;
  const y = -(bounds[1]+bounds[3])*scale/2;
  // V8 and JavaScriptCore differ in insignificant arc-rounding bits. Stable
  // serialization prevents SSR hydration mismatches without visible rounding.
  const serialize = (value: number) => Number(value.toFixed(6));
  return { bounds, scale, x, y, transform: `matrix(${serialize(scale)} 0 0 ${serialize(scale)} ${serialize(x)} ${serialize(y)})` };
}
