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
  href: "/index/example",
});

describe("graph node interaction", () => {
  it("keeps the portfolio root as a non-interactive cable anchor", () => {
    expect(nodeAction(node("root"))).toBe("none");
  });

  it("uses domain hubs to focus their project neighborhood", () => {
    expect(
      nodeAction({
        id: "domain:music",
        label: "Music promotion",
        detail: "Music projects",
        role: "domain",
        position: [1, 0, 0],
        entityIds: ["domain:music"],
        groupId: "music",
      }),
    ).toBe("focus");
  });

  it.each(["instinct", "approach", "output"] as const)(
    "opens an actionable %s step in the map detail drawer",
    (role) => {
      expect(nodeAction(node(role))).toBe("inspect");
    },
  );

  it.each([
    { missing: "projectId", projectId: undefined, href: "/index/example" },
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
