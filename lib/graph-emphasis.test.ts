import { describe, expect, it } from "vitest";
import type { SpatialGraphNode } from "./spatial-graph";
import { deriveGraphEdgeStates } from "./graph-emphasis";

const nodes: SpatialGraphNode[] = [
  {
    id: "brain",
    label: "Judgment",
    detail: "Portfolio root",
    role: "root",
    position: [0, 0, 0],
    entityIds: ["brain"],
  },
  {
    id: "music:instinct",
    label: "Music instinct",
    detail: "Instinct",
    role: "instinct",
    position: [1, 0, 0],
    entityIds: ["music:instinct"],
    parentId: "brain",
    groupId: "music",
  },
  {
    id: "music:approach",
    label: "Music approach",
    detail: "Approach",
    role: "approach",
    position: [2, 0, 0],
    entityIds: ["music:approach"],
    parentId: "music:instinct",
    groupId: "music",
  },
  {
    id: "music:output",
    label: "Music output",
    detail: "Output",
    role: "output",
    position: [3, 0, 0],
    entityIds: ["music:output"],
    parentId: "music:approach",
    groupId: "music",
  },
  {
    id: "consulting:instinct",
    label: "Consulting instinct",
    detail: "Instinct",
    role: "instinct",
    position: [-1, 0, 0],
    entityIds: ["consulting:instinct"],
    parentId: "brain",
    groupId: "consulting",
  },
];

describe("graph edge emphasis", () => {
  it("marks the complete root-to-output path active", () => {
    const edges = deriveGraphEdgeStates(nodes, {
      activeNodeId: "music:output",
      selectedDomain: null,
    });

    expect(
      edges.filter(({ active }) => active).map(({ childId }) => childId),
    ).toEqual(["music:instinct", "music:approach", "music:output"]);
  });

  it("dims branches outside the focused domain", () => {
    const edges = deriveGraphEdgeStates(nodes, {
      activeNodeId: null,
      selectedDomain: "music",
    });

    expect(
      edges.find(({ childId }) => childId === "music:instinct")?.dimmed,
    ).toBe(false);
    expect(
      edges.find(({ childId }) => childId === "consulting:instinct")?.dimmed,
    ).toBe(true);
  });
});
