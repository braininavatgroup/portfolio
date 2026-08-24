// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpatialGraphNode } from "../lib/spatial-graph";
import { PortfolioExperience } from "./PortfolioExperience";

vi.mock("./scene/PortfolioCanvas", () => ({
  PortfolioCanvas: ({
    nodes,
    onNodeSelect,
  }: {
    nodes: readonly SpatialGraphNode[];
    onNodeSelect: (node: SpatialGraphNode) => void;
  }) => (
    <div data-testid="scene-canvas">
      <output data-testid="visible-node-roles">
        {nodes.map(({ role }) => role).join(",")}
      </output>
      <button
        onClick={() => {
          const domain = nodes.find(
            (node) => node.role === "domain" && node.groupId === "music",
          );
          if (domain) onNodeSelect(domain);
        }}
        type="button"
      >
        Select Music domain
      </button>
      <button
        onClick={() =>
          onNodeSelect({
            id: "dubs:approach",
            label: "Product spec and build process",
            detail: "Connect the product spec to implementation.",
            role: "approach",
            position: [0, 0, 0],
            entityIds: ["dubs:spec", "dubs:system"],
            projectId: "project:dubs",
            projectSlug: "dubs",
            href: "/work/dubs",
            groupId: "development",
          })
        }
        type="button"
      >
        Select Dubs approach
      </button>
      <button
        onClick={() =>
          onNodeSelect({
            id: "portfolio:brain",
            label: "Bradley Berkman",
            detail: "Portfolio root",
            role: "root",
            position: [0, 0, 0],
            entityIds: ["portfolio:brain"],
          })
        }
        type="button"
      >
        Select Bradley root
      </button>
    </div>
  ),
}));

function mockMatchMedia(reducedMotion = false) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

async function renderExperience() {
  mockMatchMedia();
  render(<PortfolioExperience />);
  await act(async () => {});
}

afterEach(cleanup);

describe("spatial self-portrait", () => {
  it("opens with both portfolio views and the project index available", async () => {
    await renderExperience();

    const navigation = screen.getByRole("navigation", {
      name: "Portfolio views",
    });
    expect(navigation.querySelector('[aria-current="page"]')?.textContent).toBe(
      "Map",
    );
    expect(
      screen.getByRole("link", { name: "Index" }).getAttribute("href"),
    ).toBe("/work");
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
  });

  it("does not gate the map behind the old body transition", async () => {
    await renderExperience();

    expect(screen.queryByRole("button", { name: "Explore the work" })).toBeNull();
    expect(screen.queryByText("Moving through the glass…")).toBeNull();
  });

  it("starts with the compact hierarchy and lets a domain hub focus its projects", async () => {
    await renderExperience();

    expect(screen.getByTestId("visible-node-roles").textContent).toBe(
      [
        "root",
        "domain",
        "domain",
        "domain",
        "output",
        "output",
        "output",
        "output",
        "output",
        "output",
        "output",
        "output",
        "output",
      ].join(","),
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Music domain" }));

    expect(screen.getByTestId("visible-node-roles").textContent).toBe(
      ["root", "domain", "output", "output", "output"].join(","),
    );
    expect(
      screen
        .getByRole("button", { name: "Music promotion" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("opens a complete project dossier and lets the Bradley root restore the index", async () => {
    await renderExperience();

    fireEvent.click(screen.getByRole("button", { name: "Select Dubs approach" }));

    expect(
      screen.getByRole("complementary", { name: "Dubs project dossier" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Approach" })
        .getAttribute("aria-expanded"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Select Bradley root" }));

    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
  });

  it("keeps the dossier position when graph selection changes its contents", async () => {
    await renderExperience();
    const panel = screen.getByRole("complementary", {
      name: "Portfolio index",
    });
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 300,
      left: 600,
      right: 984,
      top: 100,
      width: 384,
      x: 600,
      y: 100,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(screen.getByLabelText("Move portfolio panel"), {
      button: 0,
      clientX: 700,
      clientY: 130,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 200,
      clientY: 200,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(panel.style.left).toBe("100px");
    expect(panel.style.top).toBe("170px");

    fireEvent.click(screen.getByRole("button", { name: "Select Dubs approach" }));

    const projectPanel = screen.getByRole("complementary", {
      name: "Dubs project dossier",
    });
    expect(projectPanel.style.left).toBe("100px");
    expect(projectPanel.style.top).toBe("170px");
  });
});
