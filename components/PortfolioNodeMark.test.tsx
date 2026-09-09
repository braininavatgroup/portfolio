// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PortfolioNodeMark,
  PortfolioContactMark,
  PortfolioControlGlyph,
  PortfolioControlMark,
} from "./PortfolioNodeMark";
import { portfolioControlMarkKinds, portfolioControlMarkPrimitives } from "../lib/portfolio-control-mark";

afterEach(cleanup);

describe("PortfolioControlGlyph", () => {
  it.each(portfolioControlMarkKinds)("renders %s through the padded control geometry contract", kind => {
    const { container } = render(<PortfolioControlGlyph kind={kind} />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("-10 -10 20 20");
    expect(container.querySelector("[transform]")).toBeNull();
    for (const path of container.querySelectorAll("svg path")) {
      expect(path.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    }
  });

  it("applies named compact sizes through the shared renderer", () => {
    const { container, rerender } = render(<PortfolioControlGlyph kind="copy" size="compact" />);
    expect(container.querySelector("svg")?.style.width).toBe("16px");
    rerender(<PortfolioControlGlyph kind="chat" size="compact" />);
    expect(container.querySelector<HTMLElement>(".portfolio-control-pattern-frame")?.style.transform).toBe("scale(0.8)");
  });

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

      expect(pattern).not.toBeNull();
      expect(container.querySelector("mask, clipPath, image, [id]")).toBeNull();
      expect(pattern.style.getPropertyValue("--control-shape")).toContain(`/glyph-textures/${kind}.svg`);
      expect(container.querySelector(".portfolio-control-pattern-ink")).toBeNull();
      cleanup();
    }
    const { container, rerender } = render(<PortfolioControlMark kind="avatarShown" aria-label="Hide avatar" aria-pressed />);
    expect(container.querySelector('[data-pattern="brain"]')).not.toBeNull();
    rerender(<PortfolioControlMark kind="avatarHidden" aria-label="Show avatar" aria-pressed={false} />);
    expect(container.querySelector('[data-pattern="brain"]')).toBeNull();
    expect(container.querySelector("path")?.getAttribute("fill")).toBe("currentColor");
    expect(screen.getByRole("button", { name: "Show avatar" }).getAttribute("aria-pressed")).toBe("false");

  });

  it("shares the left-panel artwork across mobile and desktop", () => {
    expect(portfolioControlMarkPrimitives("mobileSidebar")).toEqual(portfolioControlMarkPrimitives("sidebarLeft"));
  });
});

it("applies the approved artwork reduction once across controls, nodes, identity, and contacts", () => {
  const { container } = render(<>
    <PortfolioControlGlyph kind="avatarShown" />
    <PortfolioControlGlyph kind="avatarHidden" />
    <PortfolioControlGlyph kind="copy" size="compact" />
    <PortfolioNodeMark family="identity" register="identity" />
    <PortfolioContactMark kind="email" />
  </>);
  const marks = container.querySelectorAll<HTMLElement>(".portfolio-control-glyph, .portfolio-node-mark");
  expect(marks).toHaveLength(5);
  marks.forEach(mark => {
    expect(mark.style.scale).toBe("0.9");
    expect(mark.querySelector('[style*="scale: 0.9"]')).toBeNull();
  });
});
