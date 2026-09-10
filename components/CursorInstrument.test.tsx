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

  it("keeps following a pointer whose move events a drag library stops at the document", () => {
    // dnd-kit captures the pointer on body and stops propagation of pointermove
    // while a bar drags; the drawn cursor must still track the pointer.
    const stop = (event: Event) => event.stopPropagation();
    document.addEventListener("pointermove", stop);
    const { container } = render(
      <div className="portfolio-composition">
        <CursorInstrument />
      </div>,
    );

    fireEvent.pointerMove(document.body, { clientX: 640, clientY: 360 });

    const cursor = container.querySelector<HTMLElement>(".cursor-instrument")!;
    expect(cursor.style.left).toBe("640px");
    expect(cursor.style.top).toBe("360px");
    document.removeEventListener("pointermove", stop);
  });
});
