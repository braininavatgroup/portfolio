// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpatialGraphNode } from "../lib/spatial-graph";
import { KeyboardNavigator } from "./KeyboardNavigator";

afterEach(cleanup);

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
    id: "domain:development",
    label: "Development",
    detail: "Development projects",
    role: "domain",
    position: [0.5, 0, 0],
    entityIds: ["domain:development"],
    parentId: "brain",
    groupId: "development",
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
    href: "/index/example",
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
    href: "/index/example",
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
    href: "/index/example",
  },
];

function renderNavigator() {
  const onNodeFocus = vi.fn();
  const onNodeSelect = vi.fn();
  const view = render(
    <>
      <KeyboardNavigator
        nodes={nodes}
        onNodeFocus={onNodeFocus}
        onNodeSelect={onNodeSelect}
        selectedNodeId={null}
      />
      <label>
        Portfolio question
        <input />
      </label>
    </>,
  );
  return { ...view, onNodeFocus, onNodeSelect };
}

describe("keyboard navigator", () => {
  it("traverses graph nodes immediately without rendering a launcher", () => {
    const { onNodeFocus, onNodeSelect } = renderNavigator();

    expect(
      screen.queryByRole("button", { name: "Explore by keyboard" }),
    ).toBeNull();
    expect(
      screen.queryByRole("toolbar", { name: "Keyboard map controls" }),
    ).toBeNull();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNodeFocus).toHaveBeenLastCalledWith(nodes[1].id);
    expect(onNodeSelect).toHaveBeenLastCalledWith(nodes[1]);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNodeSelect).toHaveBeenLastCalledWith(nodes[2]);

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onNodeSelect).toHaveBeenLastCalledWith(nodes[1]);
  });

  it("leaves arrow keys alone while the visitor is typing", () => {
    const { onNodeFocus, onNodeSelect } = renderNavigator();

    fireEvent.keyDown(screen.getByLabelText("Portfolio question"), {
      key: "ArrowRight",
    });

    expect(onNodeFocus).not.toHaveBeenCalled();
    expect(onNodeSelect).not.toHaveBeenCalled();
  });

  it("uses Escape to restore the index without disabling later traversal", () => {
    const { onNodeFocus, onNodeSelect } = renderNavigator();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onNodeFocus).toHaveBeenLastCalledWith(null);
    expect(onNodeSelect).toHaveBeenLastCalledWith(null);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNodeSelect).toHaveBeenLastCalledWith(nodes[1]);
  });

  it("does nothing when the graph has no project nodes", () => {
    const onNodeFocus = vi.fn();
    const onNodeSelect = vi.fn();
    render(
      <KeyboardNavigator
        nodes={[nodes[0]]}
        onNodeFocus={onNodeFocus}
        onNodeSelect={onNodeSelect}
        selectedNodeId={null}
      />,
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(onNodeFocus).not.toHaveBeenCalled();
    expect(onNodeSelect).not.toHaveBeenCalled();
  });
});
