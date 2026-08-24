// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPortfolioDossier } from "../lib/portfolio-dossier";
import { portfolioNodes } from "../lib/spatial-graph";
import { PortfolioDossier } from "./PortfolioDossier";

afterEach(cleanup);

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
    expect(
      screen
        .getByRole("button", { name: "Music promotion" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen
        .getByRole("link", { name: /Campaign kickoff and intake/ })
        .getAttribute("href"),
    ).toBe("/work/kickoff-intake");
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
