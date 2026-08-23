import { describe, expect, it } from "vitest";
import { artifacts, portfolioNodes } from "./portfolio";
import {
  flatIndexNodeRoutes,
  graphNodeRoutes,
  keyboardNodeRoutes,
} from "./reachability";

const expectedRoutes = artifacts.flatMap((artifact) => [
    `/work/${artifact.slug}#spec`,
    `/work/${artifact.slug}#system`,
    `/work/${artifact.slug}`,
    `/work/${artifact.slug}#operation`,
  ]);

describe("three-way artifact reachability", () => {
  it("projects every actionable graph node into keyboard and flat manifests", () => {
    expect(graphNodeRoutes(portfolioNodes)).toEqual(expectedRoutes);
    expect(keyboardNodeRoutes(portfolioNodes)).toEqual(expectedRoutes);
    expect(flatIndexNodeRoutes(portfolioNodes)).toEqual(expectedRoutes);
    expect(keyboardNodeRoutes(portfolioNodes)).not.toContain("/#brain");
  });

  it("does not expose graph-only nodes", () => {
    const graphRoutes = new Set(graphNodeRoutes(portfolioNodes));
    const keyboardRoutes = new Set(keyboardNodeRoutes(portfolioNodes));
    const flatRoutes = new Set(flatIndexNodeRoutes(portfolioNodes));
    expect([...graphRoutes].filter((route) => !keyboardRoutes.has(route))).toEqual([]);
    expect([...graphRoutes].filter((route) => !flatRoutes.has(route))).toEqual([]);
  });
});
