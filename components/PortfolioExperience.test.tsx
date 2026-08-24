// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpatialGraphNode } from "../lib/spatial-graph";
import { PortfolioExperience } from "./PortfolioExperience";

vi.mock("./scene/PortfolioCanvas", () => ({
  PortfolioCanvas: ({
    nodes,
    onEnter,
    onNodeSelect,
  }: {
    nodes: readonly SpatialGraphNode[];
    onEnter: () => void;
    onNodeSelect: (node: SpatialGraphNode) => void;
  }) => (
    <div data-testid="scene-canvas">
      <output data-testid="visible-node-roles">
        {nodes.map(({ role }) => role).join(",")}
      </output>
      <button onClick={onEnter} type="button">
        Select Bradley body
      </button>
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
            href: "/index/dubs",
            groupId: "development",
          })
        }
        type="button"
      >
        Select Dubs approach
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

async function renderExperience(initialPhase: "body" | "graph" = "graph") {
  mockMatchMedia();
  render(<PortfolioExperience initialPhase={initialPhase} />);
  await act(async () => {});
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
});

describe("spatial self-portrait", () => {
  it("opens on Bradley and enters the map from the figure without exposing graph UI early", async () => {
    vi.useFakeTimers();
    await renderExperience("body");

    expect(
      screen.getByText("Bradley Berkman").getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByRole("link", { name: "Map" }).getAttribute("href")).toBe(
      "/?view=graph",
    );
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByLabelText("Keyboard map navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enter map" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select Bradley body" }));

    expect(document.querySelector(".experience-entering")).toBeTruthy();
    expect(window.location.search).toBe("?view=graph");

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(document.querySelector(".experience-graph")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
  });

  it("keeps the map primary while exposing the standalone index as a list fallback", async () => {
    await renderExperience();

    const navigation = screen.getByRole("navigation", {
      name: "Portfolio views",
    });
    expect(navigation.querySelector('[aria-current="page"]')?.textContent).toBe(
      "Map",
    );
    expect(screen.queryByRole("link", { name: "Index" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "View as list" }).getAttribute("href"),
    ).toBe("/index");
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
  });

  it("lets a direct map visit bypass the landing transition", async () => {
    await renderExperience();

    expect(screen.queryByRole("button", { name: "Enter map" })).toBeNull();
    expect(screen.queryByText("Moving through the glass…")).toBeNull();
  });

  it("reverses into the Bradley landing from the header without remounting the scene", async () => {
    vi.useFakeTimers();
    await renderExperience("graph");

    expect(document.querySelector(".experience-graph")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Bradley Berkman" }));

    expect(document.querySelector(".experience-returning")).toBeTruthy();
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(document.querySelector(".experience-body")).toBeTruthy();
    expect(
      screen.getByText("Bradley Berkman").getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.queryByRole("complementary")).toBeNull();
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

  it("opens a complete project dossier and restores the index from its back control", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Portfolio index/ }));

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
