// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PortfolioNode } from "../lib/portfolio";
import { NodeDrawer } from "./NodeDrawer";

afterEach(cleanup);

const artifact: PortfolioNode = {
  id: "kickoff-intake:artifact",
  label: "Campaign kickoff and intake",
  domain: "music",
  kind: "artifact",
  position: [0, 0, 0],
  href: "/work/kickoff-intake",
  detail: "The visible form and its linked operational workflow.",
};

describe("node drawer", () => {
  it("keeps a selected artifact in the map until its case study action is used", () => {
    render(<NodeDrawer node={artifact} onClose={() => {}} />);

    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBe(
      "node-drawer-title",
    );
    expect(screen.getByRole("heading").textContent).toBe(artifact.label);
    expect(screen.getByRole("link", { name: "View case study" }).getAttribute("href")).toBe(
      "/work/kickoff-intake",
    );
  });

  it("closes and restores focus to the supplied control", () => {
    const onClose = vi.fn();
    const returnFocusRef = createRef<HTMLButtonElement>();
    render(
      <>
        <button ref={returnFocusRef} type="button">Map controls</button>
        <NodeDrawer
          node={artifact}
          onClose={onClose}
          returnFocusRef={returnFocusRef}
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(returnFocusRef.current);
  });
});
