// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpatialGraphNode } from "../lib/spatial-graph";
import { PortfolioExperience } from "./PortfolioExperience";

vi.mock("./scene/PortfolioCanvas", () => ({
  PortfolioCanvas: ({
    onNodeSelect,
  }: {
    onNodeSelect: (node: SpatialGraphNode) => void;
  }) => (
    <div data-testid="scene-canvas">
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
      screen.getByRole("link", { name: "Work" }).getAttribute("href"),
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
});
