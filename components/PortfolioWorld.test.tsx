// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortfolioWorld } from "./PortfolioWorld";

afterEach(cleanup);

describe("PortfolioWorld", () => {
  it("keeps a focused node where the visitor drags it", () => {
    render(
      <PortfolioWorld
        activeStoryId={null}
        onReset={() => {}}
        onSelect={() => {}}
        selectedId="dubs"
      />,
    );
    const world = screen.getByRole("region", { name: "Spatial portfolio world" });
    vi.spyOn(world, "getBoundingClientRect").mockReturnValue({
      bottom: 1000,
      height: 1000,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const dubs = screen.getByRole("button", { name: "Product Dubs" });

    fireEvent.pointerDown(dubs, {
      button: 0,
      clientX: 500,
      clientY: 430,
      pointerId: 7,
    });
    fireEvent.pointerMove(world, {
      clientX: 600,
      clientY: 530,
      pointerId: 7,
    });
    fireEvent.pointerUp(world, {
      clientX: 600,
      clientY: 530,
      pointerId: 7,
    });

    expect(dubs.style.left).toBe("60%");
    expect(dubs.style.top).toBe("53%");
  });
});
