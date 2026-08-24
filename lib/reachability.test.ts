import { describe, expect, it } from "vitest";
import { portfolioData } from "./portfolio-data";
import {
  graphNodeRoutes,
  keyboardNodeRoutes,
  projectRoutes,
} from "./reachability";
import { portfolioNodes } from "./spatial-graph";

const expectedRoutes = portfolioData.projects.map(({ slug }) => `/work/${slug}`);

describe("spatial graph reachability", () => {
  it("keeps every actionable graph and keyboard node on a canonical project route", () => {
    const graphRoutes = graphNodeRoutes(portfolioNodes);
    const keyboardRoutes = keyboardNodeRoutes(portfolioNodes);

    expect(graphRoutes).toEqual(keyboardRoutes);
    expect(graphRoutes).toHaveLength(
      portfolioNodes.filter(({ href }) => typeof href === "string").length,
    );
    expect(new Set(graphRoutes)).toEqual(new Set(expectedRoutes));
    expect(graphRoutes).not.toContain("/#brain");
  });

  it("keeps the flat project manifest aligned without inventing anchor routes", () => {
    const graphRoutes = new Set(graphNodeRoutes(portfolioNodes));
    const keyboardRoutes = new Set(keyboardNodeRoutes(portfolioNodes));
    const flatRoutes = new Set(projectRoutes(portfolioData.projects));

    expect(projectRoutes(portfolioData.projects)).toEqual(expectedRoutes);
    expect([...graphRoutes].filter((route) => !keyboardRoutes.has(route))).toEqual([]);
    expect([...graphRoutes].filter((route) => !flatRoutes.has(route))).toEqual([]);
  });
});
