// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAvatarToyboxSession } from "./useAvatarToyboxSession";
import { AvatarToyboxOverlay } from "./AvatarToyboxOverlay";

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="toybox-avatar-canvas">{children}</div>
  ),
}));

vi.mock("../avatar/AvatarAssetAdapter", () => ({
  AvatarAssetAdapter: ({ anchor, animation, facing }: { anchor?: string; animation: string; facing: string }) => (
    <div data-anchor={anchor} data-animation={animation} data-facing={facing} data-testid="toybox-avatar-model" />
  ),
}));

const roster = [{ id: "one", label: "One" }];

function Harness({
  collectibles = roster,
  reducedMotion = false,
}: {
  collectibles?: typeof roster;
  reducedMotion?: boolean;
}) {
  const session = useAvatarToyboxSession({
    canOpen: () => true,
    collectibles,
    reducedMotion,
  });
  return <AvatarToyboxOverlay session={session} />;
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const shell = document.body.appendChild(document.createElement("div"));
  shell.id = "app-shell";
  const main = shell.appendChild(document.createElement("main"));
  main.id = "main-content";
  main.tabIndex = -1;
  const portal = document.body.appendChild(document.createElement("div"));
  portal.id = "avatar-toybox-root";
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("AvatarToyboxOverlay", () => {
  it("renders the chooser in the portal, starts Brain Food, and exits", () => {
    render(<Harness />, { container: document.getElementById("app-shell")! });
    fireEvent.keyDown(document, { key: "g", shiftKey: true });

    expect(screen.getByRole("dialog", { name: "Avatar toybox" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Brain Food/ }));

    expect(screen.getByText(/Score 0 of 1 · 20s/)).toBeTruthy();
    expect(screen.getByTestId("toybox-avatar-canvas")).toBeTruthy();
    expect(screen.getByLabelText("Collect One")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close game" }));
    expect(screen.queryByRole("dialog", { name: "Avatar toybox" })).toBeNull();
  });

  it("starts Toss Bradley and forwards pointer capture input", () => {
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    render(<Harness />, { container: document.getElementById("app-shell")! });
    fireEvent.keyDown(document, { key: "g", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Toss Bradley/ }));

    const hitbox = screen.getByLabelText("Bradley. Drag and release to toss.");
    fireEvent.pointerDown(hitbox, { pointerId: 7, clientX: 400, clientY: 300 });
    expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalledWith(7);
    fireEvent.pointerUp(hitbox, { pointerId: 7, clientX: 500, clientY: 350 });
    expect(HTMLElement.prototype.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("keeps the Brain Food avatar front-facing while it moves left", () => {
    render(<Harness reducedMotion />, { container: document.getElementById("app-shell")! });
    fireEvent.keyDown(document, { key: "g", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Brain Food/ }));
    fireEvent.keyDown(document, { key: "ArrowLeft" });

    expect(screen.getByTestId("toybox-avatar-model").dataset.facing).toBe("front");
    expect(screen.getByTestId("toybox-avatar-model").dataset.anchor).toBe("center");
  });

  it("dismisses the completion screen from its close control or playfield", () => {
    render(<Harness collectibles={[]} />, { container: document.getElementById("app-shell")! });
    fireEvent.keyDown(document, { key: "g", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Brain Food/ }));

    expect(screen.getByText("Round complete")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close completed game" }));
    expect(screen.queryByRole("dialog", { name: "Avatar toybox" })).toBeNull();

    fireEvent.keyDown(document, { key: "g", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Brain Food/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close game from playfield" }));
    expect(screen.queryByRole("dialog", { name: "Avatar toybox" })).toBeNull();
  });
});
