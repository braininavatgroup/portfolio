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

    const trigger = screen.getByRole("button", { name: "Explore by keyboard" });
    fireEvent.click(trigger);
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

  it("requires trigger activation before arrow navigation begins", () => {
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

    const trigger = screen.getByRole("button", { name: "Explore by keyboard" });
    fireEvent.focus(trigger);
    fireEvent.keyDown(screen.getByRole("toolbar", { name: "Keyboard map controls" }), {
      key: "ArrowRight",
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "Next node" })).toBeNull();
    expect(onNodeFocus).not.toHaveBeenCalled();
    expect(onNodeSelect).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(onNodeFocus).toHaveBeenLastCalledWith(nodes[1].id);
  });

  it("stays collapsed after Escape restores focus to its trigger", () => {
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

    const trigger = screen.getByRole("button", { name: "Explore by keyboard" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Next node" }));
    fireEvent.keyDown(screen.getByRole("toolbar", { name: "Keyboard map controls" }), {
      key: "Escape",
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole("button", { name: "Next node" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous node" })).toBeNull();
    expect(onNodeFocus).toHaveBeenLastCalledWith(null);
    expect(onNodeSelect).toHaveBeenLastCalledWith(null);
  });

  it("collapses and clears focus when its controlled selection closes", () => {
    const onNodeFocus = vi.fn();
    const onNodeSelect = vi.fn();
    const { rerender } = render(
      <KeyboardNavigator
        nodes={nodes}
        onNodeFocus={onNodeFocus}
        onNodeSelect={onNodeSelect}
        selectedNodeId={nodes[2].id}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Explore by keyboard" });
    fireEvent.click(trigger);
    expect(screen.getByText("Approach")).toBeTruthy();

    rerender(
      <KeyboardNavigator
        nodes={nodes}
        onNodeFocus={onNodeFocus}
        onNodeSelect={onNodeSelect}
        selectedNodeId={null}
      />,
    );

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Approach")).toBeNull();
    expect(screen.queryByText("Instinct")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next node" })).toBeNull();
    expect(onNodeFocus).toHaveBeenLastCalledWith(null);
  });
});
