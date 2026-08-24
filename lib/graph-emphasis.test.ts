import { describe, expect, it } from "vitest";
import type { SpatialGraphNode } from "./spatial-graph";
import { deriveGraphEdgeStates, visibleGraphNodes } from "./graph-emphasis";

const nodes: SpatialGraphNode[] = [
  {
    id: "brain",
    label: "Bradley Berkman",
    detail: "Portfolio root",
    role: "root",
    position: [0, 0, 0],
    entityIds: ["brain"],
  },
  {
    id: "domain:music",
    label: "Music promotion",
    detail: "Music projects",
    role: "domain",
    position: [1, 0, 0],
    entityIds: ["domain:music"],
    parentId: "brain",
    groupId: "music",
  },
  {
    id: "music:instinct",
    label: "Music instinct",
    detail: "Instinct",
    role: "instinct",
    position: [2, 0, 0],
    entityIds: ["music:instinct"],
    parentId: "domain:music",
    groupId: "music",
    projectId: "music-project",
  },
  {
    id: "music:approach",
    label: "Music approach",
    detail: "Approach",
    role: "approach",
    position: [3, 0, 0],
    entityIds: ["music:approach"],
    parentId: "music:instinct",
    groupId: "music",
    projectId: "music-project",
  },
  {
    id: "music:output",
    label: "Music output",
    detail: "Output",
    role: "output",
    position: [4, 0, 0],
    entityIds: ["music:output"],
    parentId: "music:approach",
    groupId: "music",
    projectId: "music-project",
  },
  {
    id: "music:sibling-instinct",
    label: "Sibling instinct",
    detail: "Instinct",
    role: "instinct",
    position: [2, 1, 0],
    entityIds: ["music:sibling-instinct"],
    parentId: "domain:music",
    groupId: "music",
    projectId: "music-sibling",
  },
  {
    id: "music:sibling-approach",
    label: "Sibling approach",
    detail: "Approach",
    role: "approach",
    position: [3, 1, 0],
    entityIds: ["music:sibling-approach"],
    parentId: "music:sibling-instinct",
    groupId: "music",
    projectId: "music-sibling",
  },
  {
    id: "music:sibling-output",
    label: "Sibling output",
    detail: "Output",
    role: "output",
    position: [4, 1, 0],
    entityIds: ["music:sibling-output"],
    parentId: "music:sibling-approach",
    groupId: "music",
    projectId: "music-sibling",
  },
  {
    id: "domain:consulting",
    label: "Consulting",
    detail: "Consulting projects",
    role: "domain",
    position: [-1, 0, 0],
    entityIds: ["domain:consulting"],
    parentId: "brain",
    groupId: "consulting",
  },
  {
    id: "consulting:output",
    label: "Consulting output",
    detail: "Output",
    role: "output",
    position: [-4, 0, 0],
    entityIds: ["consulting:output"],
    parentId: "domain:consulting",
    groupId: "consulting",
    projectId: "consulting-project",
  },
];

describe("graph edge emphasis", () => {
  it("marks the complete domain-to-output path active", () => {
    const edges = deriveGraphEdgeStates(nodes, {
      activeNodeId: "music:output",
      selectedDomain: null,
    });

    expect(
      edges.filter(({ active }) => active).map(({ childId }) => childId),
    ).toEqual([
      "domain:music",
      "music:instinct",
      "music:approach",
      "music:output",
    ]);
    expect(
      edges.find(({ childId }) => childId === "music:sibling-output")?.dimmed,
    ).toBe(true);
    expect(
      edges.find(({ childId }) => childId === "music:approach")?.dimmed,
    ).toBe(false);
  });

  it("dims branches outside the focused domain", () => {
    const edges = deriveGraphEdgeStates(nodes, {
      activeNodeId: null,
      selectedDomain: "music",
    });

    expect(
      edges.find(({ childId }) => childId === "domain:music")?.dimmed,
    ).toBe(false);
    expect(
      edges.find(({ childId }) => childId === "domain:consulting")?.dimmed,
    ).toBe(true);
  });
});

describe("visible graph hierarchy", () => {
  it("shows only Bradley, domain hubs, and project outputs in the overview", () => {
    const visible = visibleGraphNodes(nodes, {
      selectedDomain: null,
      selectedProjectId: null,
    });

    expect(visible.map(({ id }) => id)).toEqual([
      "brain",
      "domain:music",
      "music:output",
      "music:sibling-output",
      "domain:consulting",
      "consulting:output",
    ]);
    expect(visible.find(({ id }) => id === "music:output")?.parentId).toBe(
      "domain:music",
    );
  });

  it("reveals only the selected project's complete chain", () => {
    const visible = visibleGraphNodes(nodes, {
      selectedDomain: "music",
      selectedProjectId: "music-project",
    });

    expect(visible.map(({ id }) => id)).toEqual([
      "brain",
      "domain:music",
      "music:instinct",
      "music:approach",
      "music:output",
      "music:sibling-output",
    ]);
    expect(
      visible.find(({ id }) => id === "music:sibling-output")?.parentId,
    ).toBe("domain:music");
    expect(visible.find(({ id }) => id === "music:output")?.parentId).toBe(
      "music:approach",
    );
  });

  it("focuses a domain without exposing every project's internal steps", () => {
    expect(
      visibleGraphNodes(nodes, {
        selectedDomain: "music",
        selectedProjectId: null,
      }).map(({ id }) => id),
    ).toEqual([
      "brain",
      "domain:music",
      "music:output",
      "music:sibling-output",
    ]);
  });
});
