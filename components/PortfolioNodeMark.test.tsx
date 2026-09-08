// @vitest-environment jsdom

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PortfolioControlGlyph,
  PortfolioControlMark,
} from "./PortfolioNodeMark";
import { portfolioControlMarkPrimitives } from "../lib/portfolio-control-mark";

afterEach(cleanup);

describe("PortfolioControlGlyph", () => {
  it("exports the existing control artwork without an interactive wrapper", () => {
    const { container } = render(<PortfolioControlGlyph kind="reader" />);
    const glyph = container.querySelector<HTMLElement>('[data-control-glyph="reader"]')!;

    expect(glyph.tagName).toBe("SPAN");
    expect(glyph.getAttribute("aria-hidden")).toBe("true");
    expect(glyph.closest("button")).toBeNull();
  });

  it("keeps PortfolioControlMark as the labeled button wrapper", () => {
    render(
      <PortfolioControlMark
        aria-label="Show Reader"
        kind="reader"
        onClick={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Show Reader" });
    expect(button.querySelector('[data-control-glyph="reader"]')).not.toBeNull();
  });

  it("draws the Map and Guide pattern as an id-free CSS mask of the outline", async () => {
    for (const kind of ["map", "chat"] as const) {
      const { container } = render(<PortfolioControlGlyph kind={kind} />);
      const pattern = container.querySelector<HTMLElement>('.portfolio-control-pattern[data-pattern="brain"]')!;
      const [outline] = portfolioControlMarkPrimitives(kind);

      expect(pattern).not.toBeNull();
      expect(container.querySelector("mask, clipPath, image, [id]")).toBeNull();
      expect(decodeURIComponent(pattern.style.getPropertyValue("--control-shape"))).toContain(
        outline.kind === "path" ? outline.d : "",
      );
      cleanup();
    }
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const rule = stylesheet.match(/\.portfolio-control-pattern\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain('mask-image: var(--control-shape), url("/biv-brain-symbol.svg")');
    expect(rule).toContain("mask-size: contain, 100% 100%");
    expect(rule).toContain("mask-composite: intersect");
    expect(rule).toContain("background: currentColor");
  });

  it("keeps the mobile Contents panel glyph distinct from the desktop sidebar control", () => {
    expect(portfolioControlMarkPrimitives("mobileSidebar")).toEqual([
      {
        d: "M-6.5 -6H6.5A1 1 0 0 1 7.5 -5V5A1 1 0 0 1 6.5 6H-6.5A1 1 0 0 1 -7.5 5V-5A1 1 0 0 1 -6.5 -6Z M-2.5 -6V6",
        fill: false,
        kind: "path",
      },
    ]);
  });
});
