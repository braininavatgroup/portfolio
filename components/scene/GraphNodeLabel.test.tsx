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
  href: "/work/field-map",
};

describe("GraphNodeLabel", () => {
  it("exposes the projection role and full title in an interactive label", () => {
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
  });

  it("renders an inert label as text without a button", () => {
    render(
      <GraphNodeLabel
        node={approachNode}
        interactive={false}
        emphasized={false}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("Approach")).toBeTruthy();
    expect(screen.getByText("Requirements and field map")).toBeTruthy();
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
});
