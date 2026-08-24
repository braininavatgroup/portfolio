// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
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

function renderNavigator() {
  const onNodeFocus = vi.fn();
  const onNodeSelect = vi.fn();
  const { container } = render(
    <KeyboardNavigator
      nodes={nodes}
      onNodeFocus={onNodeFocus}
      onNodeSelect={onNodeSelect}
      selectedNodeId={null}
    />,
  );
  return { container, onNodeFocus, onNodeSelect };
}

describe("automatic graph keyboard navigation", () => {
  it("starts on the first node and wraps through arrow navigation", () => {
    const { onNodeFocus, onNodeSelect } = renderNavigator();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onNodeFocus).toHaveBeenLastCalledWith(nodes[1].id);
    expect(onNodeSelect).toHaveBeenLastCalledWith(nodes[1]);

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onNodeSelect).toHaveBeenLastCalledWith(nodes[2]);

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(onNodeSelect).toHaveBeenLastCalledWith(nodes[1]);
  });

  it("ignores keys originating in controls and editable fields", () => {
    const { onNodeFocus, onNodeSelect } = renderNavigator();
    const input = document.body.appendChild(document.createElement("input"));
    const button = document.body.appendChild(document.createElement("button"));

    fireEvent.keyDown(input, { key: "ArrowRight" });
    fireEvent.keyDown(button, { key: "ArrowRight" });

    expect(onNodeFocus).not.toHaveBeenCalled();
    expect(onNodeSelect).not.toHaveBeenCalled();
  });

  it("clears the focused node on Escape", () => {
    const { onNodeFocus, onNodeSelect } = renderNavigator();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onNodeFocus).toHaveBeenLastCalledWith(null);
    expect(onNodeSelect).toHaveBeenLastCalledWith(null);
  });

  it("renders no keyboard-control UI", () => {
    const { container } = renderNavigator();
    expect(container.querySelector(".keyboard-navigator")).toBeNull();
  });
});
