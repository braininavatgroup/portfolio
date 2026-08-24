// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PortfolioEntity } from "../lib/portfolio-model";
import type { SpatialGraphNode } from "../lib/spatial-graph";
import { NodeDrawer } from "./NodeDrawer";

afterEach(cleanup);

const approachNode: SpatialGraphNode = {
  id: "kickoff-intake:approach",
  label: "Plan the kickoff loop",
  detail: "The step joins requirements and workflow design.",
  role: "approach",
  position: [0, 0, 0],
  entityIds: ["workflow", "requirements"],
  projectId: "kickoff-intake",
  projectSlug: "kickoff-intake",
  href: "/index/kickoff-intake",
};

const entities: PortfolioEntity[] = [
  {
    id: "requirements",
    title: "Requirements and field map",
    summary: "The fields, states, and payment sequence.",
  },
  {
    id: "workflow",
    title: "Kickoff workflow",
    summary: "The operational handoff and automation path.",
    links: [
      { label: "Duplicate case study", href: "/index/kickoff-intake" },
      { label: "Inspect workflow", href: "/workflows/kickoff" },
    ],
  },
];

describe("node drawer", () => {
  it("renders grouped entities in step order without duplicating the canonical case-study link", () => {
    render(
      <NodeDrawer
        node={approachNode}
        entities={entities}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBe(
      "node-drawer-title",
    );
    expect(screen.getByText("Approach")).toBeTruthy();
    expect(screen.getByText("2 of 3 in this projection")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: approachNode.label }),
    ).toBeTruthy();
    expect(screen.getByText(approachNode.detail)).toBeTruthy();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map(({ textContent }) => textContent),
    ).toEqual(["Kickoff workflow", "Requirements and field map"]);
    expect(screen.getByText("The operational handoff and automation path.")).toBeTruthy();
    expect(screen.getByText("The fields, states, and payment sequence.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Duplicate case study" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Inspect workflow" }).getAttribute("href"),
    ).toBe("/workflows/kickoff");
    expect(screen.getAllByRole("link", { name: "View case study" })).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "View case study" }).getAttribute("href"),
    ).toBe("/index/kickoff-intake");
  });

  it("keeps the heading and close control outside the scrolling details", () => {
    render(
      <NodeDrawer
        node={approachNode}
        entities={entities}
        onClose={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog");
    const details = dialog.querySelector(".node-drawer-content");

    expect(details).not.toBeNull();
    if (!details) throw new Error("Drawer details must have their own scroll region.");

    expect(details.contains(
      screen.getByRole("heading", { level: 2, name: approachNode.label }),
    )).toBe(true);
    expect(details.contains(
      screen.getByRole("heading", { level: 3, name: "Kickoff workflow" }),
    )).toBe(true);
    expect(details.contains(
      screen.getByRole("button", { name: "Close details" }),
    )).toBe(false);
  });

  it("closes and restores focus to the supplied control", () => {
    const onClose = vi.fn();
    const returnFocusRef = createRef<HTMLButtonElement>();
    render(
      <>
        <button ref={returnFocusRef} type="button">Map controls</button>
        <NodeDrawer
          node={approachNode}
          entities={entities}
          onClose={onClose}
          returnFocusRef={returnFocusRef}
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(returnFocusRef.current);
  });
});
