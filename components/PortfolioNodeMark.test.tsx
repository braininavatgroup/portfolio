// @vitest-environment jsdom

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

  it("centres the 170% brain pattern inside the Map and Guide outlines", () => {
    for (const kind of ["map", "chat"] as const) {
      const { container } = render(<PortfolioControlGlyph kind={kind} />);
      const image = container.querySelector('svg[data-pattern="brain"] mask image')!;
      const size = Number(image.getAttribute("width"));

      expect(size).toBeCloseTo(18 * 1.7);
      expect(Number(image.getAttribute("height"))).toBeCloseTo(size);
      expect(Number(image.getAttribute("x")) + size / 2).toBeCloseTo(0);
      expect(Number(image.getAttribute("y")) + size / 2).toBeCloseTo(0);
      cleanup();
    }
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
