import { describe, expect, it } from "vitest";
import { svgPathBbox } from "svg-path-bbox";
import approvedA from "../tests/fixtures/portfolio-controls-a.json";
import { portfolioControlMarkKinds, portfolioControlMarkPrimitives } from "./portfolio-control-mark";
import { controlGeometry } from "./portfolio-control-geometry";
import type { PortfolioNodeMarkPrimitive } from "./portfolio-node-mark";

describe("approved A control artwork", () => {
  it("keeps the approved inventory", () => {
    expect(portfolioControlMarkKinds).toEqual(Object.keys(approvedA));
  });
  it.each(portfolioControlMarkKinds.filter(kind => !["avatarShown", "avatarHidden", "sidebarLeft", "sidebarRight", "mobileSidebar", "panelBottom"].includes(kind)))("preserves %s artwork bounds without runtime fitting", kind => {
    const original = approvedA[kind] as PortfolioNodeMarkPrimitive[];
    const geometry = controlGeometry(original);
    const [path] = portfolioControlMarkPrimitives(kind);
    expect(path.kind).toBe("path");
    if (path.kind !== "path") return;
    const bounds = svgPathBbox(path.d);
    const expected = geometry.bounds.map((v, i) => v * geometry.scale + (i % 2 ? geometry.y : geometry.x));
    bounds.forEach((v,i) => expect(v).toBeCloseTo(expected[i], 4));
    expect(bounds.every(Number.isFinite)).toBe(true);
  });
  it.each(["sidebarLeft", "sidebarRight", "mobileSidebar", "panelBottom"] as const)("aligns %s to the shared 18px frame", kind => {
    const [path] = portfolioControlMarkPrimitives(kind);
    if (path.kind !== "path") throw new Error("Expected panel path");
    const [left,top,right,bottom] = svgPathBbox(path.d);
    expect(right-left+1.25).toBeCloseTo(18, 5);
    expect(bottom-top+1.25).toBeCloseTo(18, 5);
    expect(left+right).toBeCloseTo(0, 5);
    expect(top+bottom).toBeCloseTo(0, 5);
  });
  it("keeps the connected bust centered in the 18px ink height", () => {
    const [path] = portfolioControlMarkPrimitives("avatarShown");
    if (path.kind !== "path") throw new Error("Expected avatar path");
    expect(path.d.match(/m/gi)).toHaveLength(1);
    expect(path.d.match(/z/gi)).toHaveLength(1);
    const [left, top, right, bottom] = svgPathBbox(path.d);
    expect(left + right).toBeCloseTo(0, 5);
    expect(top + bottom).toBeCloseTo(0, 5);
    expect(bottom - top + 1.25).toBeCloseTo(18, 5);
    expect(right - left + 1.25).toBeCloseTo(16.25, 5);
  });
  it("uses identical silhouettes for avatar states", () => {
    expect(portfolioControlMarkPrimitives("avatarShown")).toEqual(portfolioControlMarkPrimitives("avatarHidden"));
  });
});
