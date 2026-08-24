import { describe, expect, it } from "vitest";
import type { SpatialGraphNode } from "./spatial-graph";
import { nodeAction } from "./node-interaction";

const node = (role: SpatialGraphNode["role"]): SpatialGraphNode => ({
  id: role,
  label: role,
  detail: `${role} detail`,
  role,
  position: [0, 0, 0],
  entityIds: [role],
  projectId: "example",
  projectSlug: "example",
  href: "/work/example",
});

describe("graph node interaction", () => {
  it("uses the portfolio root to restore the index", () => {
    expect(nodeAction(node("root"))).toBe("index");
  });

  it.each(["instinct", "approach", "output"] as const)(
    "opens an actionable %s step in the map detail drawer",
    (role) => {
      expect(nodeAction(node(role))).toBe("inspect");
    },
  );

  it.each([
    { missing: "projectId", projectId: undefined, href: "/work/example" },
    { missing: "href", projectId: "example", href: undefined },
  ])("keeps a step missing $missing inert", ({ projectId, href }) => {
    expect(
      nodeAction({
        ...node("approach"),
        projectId,
        href,
      }),
    ).toBe("none");
  });
});
