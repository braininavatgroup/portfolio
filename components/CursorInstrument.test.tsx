// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CursorInstrument } from "./CursorInstrument";

afterEach(cleanup);

describe("CursorInstrument", () => {
  it("uses the hovered node's resolved register color and its exact inverse", () => {
    const { container } = render(
      <div className="portfolio-composition" style={{ "--world-warm": "#D0007E" } as React.CSSProperties}>
        <button data-cursor-color="--world-warm" data-world-node="infamous" type="button" />
        <CursorInstrument />
      </div>,
    );
    const node = container.querySelector<HTMLElement>("[data-world-node]")!;

    fireEvent.pointerMove(node, { clientX: 120, clientY: 80 });

    const cursor = container.querySelector<HTMLElement>(".cursor-instrument")!;
    expect(cursor.style.getPropertyValue("--cursor-a")).toBe("#D0007E");
    expect(cursor.style.getPropertyValue("--cursor-b")).toBe("#2fff81");
  });
});
