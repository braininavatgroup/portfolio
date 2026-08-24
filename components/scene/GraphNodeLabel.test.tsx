// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpatialGraphNode } from "../../lib/spatial-graph";
import { GraphNodeLabel } from "./GraphNodeLabel";

afterEach(cleanup);

const approachNode: SpatialGraphNode = {
  id: "field-map:approach",
  label: "Requirements and field map",
  detail: "A shared working model for the project.",
  role: "approach",
  position: [0, 0, 0],
  entityIds: ["field-map"],
  projectId: "field-map",
  projectSlug: "field-map",
  href: "/index/field-map",
};

const outputNode: SpatialGraphNode = {
  ...approachNode,
  id: "field-map:output",
  label: "Field map",
  role: "output",
};

const rootNode: SpatialGraphNode = {
  id: "portfolio:brain",
  label: "Bradley Berkman",
  detail: "Portfolio root",
  role: "root",
  position: [0, 0, 0],
  entityIds: ["portfolio:brain"],
};

describe("GraphNodeLabel", () => {
  it("keeps the full step title accessible while showing a compact role label", () => {
    render(
      <GraphNodeLabel
        node={approachNode}
        interactive
        emphasized={false}
        onSelect={() => {}}
      />,
    );

    const label = screen.getByRole("button", {
      name: /Approach.+Requirements and field map/,
    });

    expect(label).toBeTruthy();
    expect(label.getAttribute("data-emphasized")).toBe("false");
    expect(screen.getByText("02 · Approach")).toBeTruthy();
    expect(screen.queryByText("Requirements and field map")).toBeNull();
  });

  it("uses the same compact role label for an inert step", () => {
    render(
      <GraphNodeLabel
        node={approachNode}
        interactive={false}
        emphasized={false}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("02 · Approach")).toBeTruthy();
    expect(screen.queryByText("Requirements and field map")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("selects the node when its interactive label is clicked", () => {
    const onSelect = vi.fn();
    render(
      <GraphNodeLabel
        node={approachNode}
        interactive
        emphasized={false}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Approach.+Requirements and field map/,
      }),
    );

    expect(onSelect).toHaveBeenCalledWith(approachNode);
  });

  it("exposes the emphasized reading state on the rendered label", () => {
    render(
      <GraphNodeLabel
        node={approachNode}
        interactive
        emphasized
        onSelect={() => {}}
      />,
    );

    expect(
      screen
        .getByRole("button", {
          name: /Approach.+Requirements and field map/,
        })
        .getAttribute("data-emphasized"),
    ).toBe("true");
  });

  it("exposes the selected node as a pressed control", () => {
    render(
      <GraphNodeLabel
        node={approachNode}
        interactive
        emphasized
        selected
        onSelect={() => {}}
      />,
    );

    const label = screen.getByRole("button", {
      name: /Approach.+Requirements and field map/,
    });

    expect(label.getAttribute("aria-pressed")).toBe("true");
    expect(label.getAttribute("data-role")).toBe("approach");
  });

  it("shows an output title without repeating its numbered role", () => {
    render(
      <GraphNodeLabel
        node={outputNode}
        interactive
        emphasized={false}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("Field map")).toBeTruthy();
    expect(screen.queryByText("03 · Output")).toBeNull();
  });

  it("does not render a separate label or button for the Bradley root", () => {
    const { container } = render(
      <GraphNodeLabel
        node={rootNode}
        interactive={false}
        emphasized={false}
        onSelect={() => {}}
      />,
    );

    expect(container.innerHTML).toBe("");
  });
});
