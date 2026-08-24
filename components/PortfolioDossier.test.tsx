// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPortfolioDossier } from "../lib/portfolio-dossier";
import { portfolioNodes } from "../lib/spatial-graph";
import { PortfolioDossier } from "./PortfolioDossier";

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 768,
  });
});

describe("portfolio dossier", () => {
  it("keeps canonical project routes available from the initial index", () => {
    render(
      <PortfolioDossier
        dossier={undefined}
        onDomainSelect={vi.fn()}
        onShowIndex={vi.fn()}
        selectedDomain={null}
      />,
    );

    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
    const music = screen.getByRole("button", { name: "Music promotion" });
    expect(music.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(music);
    expect(
      screen
        .getByRole("link", { name: /Campaign kickoff and intake/ })
        .getAttribute("href"),
    ).toBe("/work/kickoff-intake");
  });

  it("drags the dossier by its header and keeps it inside the viewport", () => {
    render(
      <PortfolioDossier
        dossier={undefined}
        onDomainSelect={vi.fn()}
        onShowIndex={vi.fn()}
        selectedDomain={null}
      />,
    );
    const panel = screen.getByRole("complementary", {
      name: "Portfolio index",
    });
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      bottom: 600,
      height: 500,
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
      clientX: 1200,
      clientY: 900,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(panel.style.left).toBe("628px");
    expect(panel.style.top).toBe("256px");
    expect(panel.style.transform).toBe("none");
  });

  it("keeps the docked mobile dossier fixed", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    render(
      <PortfolioDossier
        dossier={undefined}
        onDomainSelect={vi.fn()}
        onShowIndex={vi.fn()}
        selectedDomain={null}
      />,
    );

    fireEvent.pointerDown(screen.getByLabelText("Move portfolio panel"), {
      button: 0,
      clientX: 40,
      clientY: 450,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 200,
      clientY: 200,
      pointerId: 1,
    });

    const panel = screen.getByRole("complementary", {
      name: "Portfolio index",
    });
    expect(panel.style.left).toBe("");
    expect(panel.style.top).toBe("");
  });

  it("opens the selected project role inside a complete project dossier", () => {
    const node = portfolioNodes.find(
      ({ projectSlug, role }) =>
        projectSlug === "dubs" && role === "approach",
    );
    if (!node) throw new Error("Missing Dubs approach node");
    const dossier = getPortfolioDossier(node);
    if (!dossier) throw new Error("Missing Dubs dossier");

    render(
      <PortfolioDossier
        dossier={dossier}
        onDomainSelect={vi.fn()}
        onShowIndex={vi.fn()}
        selectedDomain="development"
      />,
    );

    expect(
      screen.getByRole("complementary", { name: "Dubs project dossier" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Approach" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen
        .getByRole("link", { name: "Read the full Dubs case study" })
        .getAttribute("href"),
    ).toBe("/work/dubs");
  });
});
