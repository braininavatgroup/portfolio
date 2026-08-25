// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarController } from "../../lib/avatar/controller";
import { AvatarTargetRegistry } from "../../lib/avatar/target-registry";
import { AvatarOverlay } from "./AvatarOverlay";

vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return {
    ...actual,
    Canvas: () => <div data-testid="avatar-canvas" />,
  };
});

afterEach(cleanup);

describe("AvatarOverlay", () => {
  it("keeps the render layer inert while preserving the hide and show control", () => {
    // Catches an overlay that intercepts the page, becomes the sole information path, or loses its escape hatch.
    const controller = new AvatarController(new AvatarTargetRegistry());
    controller.execute({ action: "setState", state: "thinking" });
    const onEnabledChange = vi.fn();
    const { container } = render(
      <AvatarOverlay
        controller={controller}
        enabled
        onEnabledChange={onEnabledChange}
      />,
    );

    const overlay = container.querySelector(".avatar-overlay");
    const control = screen.getByRole("button", { name: "Hide assistant" });
    expect(overlay?.className).toContain("pointer-events-none");
    expect(overlay?.getAttribute("data-avatar-state")).toBe("thinking");
    expect(control.className).toContain("pointer-events-auto");
    expect(screen.getByTestId("avatar-canvas")).toBeTruthy();

    fireEvent.click(control);

    expect(onEnabledChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Show assistant" })).toBeTruthy();
    expect(screen.queryByTestId("avatar-canvas")).toBeNull();
  });

  it("keeps developer controls out of normal rendering and shows them only behind both guards", () => {
    // Catches development controls leaking into production-like rendering or becoming impossible to reach when opted in.
    const controller = new AvatarController(new AvatarTargetRegistry());
    const { rerender } = render(
      <AvatarOverlay
        controller={controller}
        enabled
        onEnabledChange={() => {}}
        debug
      />,
    );

    expect(screen.queryByRole("heading", { name: "Avatar developer controls" })).toBeNull();

    rerender(
      <AvatarOverlay
        controller={controller}
        enabled
        development
        debug
        onEnabledChange={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Avatar developer controls" })).toBeTruthy();
  });

  it("removes a failed renderer while retaining the visibility control", () => {
    // Catches a model failure that removes the only way to recover or propagates outside the avatar boundary.
    const controller = new AvatarController(new AvatarTargetRegistry());
    controller.markFailed();

    render(
      <AvatarOverlay
        controller={controller}
        enabled
        onEnabledChange={() => {}}
      />,
    );

    expect(screen.queryByTestId("avatar-canvas")).toBeNull();
    expect(screen.getByRole("button", { name: "Hide assistant" })).toBeTruthy();
  });
});
