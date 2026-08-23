// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpatialGraphNode } from "../lib/spatial-graph";
import { KeyboardNavigator } from "./KeyboardNavigator";

afterEach(cleanup);

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
    id: "example:instinct",
    label: "Find the costly judgment",
    detail: "Instinct detail",
    role: "instinct",
    position: [1, 0, 0],
    entityIds: ["instinct"],
    projectId: "example",
    projectSlug: "example",
    href: "/work/example",
  },
  {
    id: "example:approach",
    label: "Map the requirements",
    detail: "Approach detail",
    role: "approach",
    position: [2, 0, 0],
    entityIds: ["approach"],
    projectId: "example",
    projectSlug: "example",
    href: "/work/example",
  },
  {
    id: "example:output",
    label: "Ship the workflow",
    detail: "Output detail",
    role: "output",
    position: [3, 0, 0],
    entityIds: ["output"],
    projectId: "example",
    projectSlug: "example",
    href: "/work/example",
  },
];

describe("keyboard navigator", () => {
  it("traverses the supplied actionable nodes and derives its displayed total", () => {
    const onNodeFocus = vi.fn();
    const onNodeSelect = vi.fn();
    render(
      <KeyboardNavigator
        nodes={nodes}
        onNodeFocus={onNodeFocus}
        onNodeSelect={onNodeSelect}
        selectedNodeId={null}
      />,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Explore by keyboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Next node" }));

    expect(onNodeSelect).toHaveBeenLastCalledWith(nodes[2]);
    expect(screen.getByText("Approach")).toBeTruthy();
    expect(screen.getByText("2 of 3")).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("toolbar", { name: "Keyboard map controls" }), {
      key: "ArrowLeft",
    });
    expect(onNodeSelect).toHaveBeenLastCalledWith(nodes[1]);
    expect(screen.getByText("Instinct")).toBeTruthy();
    expect(screen.getByText("1 of 3")).toBeTruthy();
  });

  it("disables exploration when the supplied graph has no actionable nodes", () => {
    render(
      <KeyboardNavigator
        nodes={[nodes[0]]}
        onNodeFocus={() => {}}
        onNodeSelect={() => {}}
        selectedNodeId={null}
      />,
    );

    expect(
      (screen.getByRole("button", {
        name: "Explore by keyboard",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Next node" })).toBeNull();
  });
});
