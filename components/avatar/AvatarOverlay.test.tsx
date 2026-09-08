// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarRuntime } from "../../lib/avatar/runtime";
import { AvatarOverlay } from "./AvatarOverlay";

type CanvasMockProps = {
  children?: React.ReactNode;
  "aria-hidden"?: React.AriaAttributes["aria-hidden"];
  camera?: { position?: readonly [number, number, number] };
  frameloop?: string;
  gl?: unknown;
  orthographic?: boolean;
};

const canvasMockState = vi.hoisted(() => ({
  gl: null as null | ((props: unknown) => Promise<unknown>),
}));

vi.mock("./AvatarStageActor", () => ({
  AvatarStageActor: () => <div data-testid="avatar-stage-actor" />,
}));

vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return {
    ...actual,
    Canvas: ({
      children,
      "aria-hidden": ariaHidden,
      camera,
      frameloop,
      gl,
      orthographic,
    }: CanvasMockProps) => {
      canvasMockState.gl =
        typeof gl === "function"
          ? (gl as (props: unknown) => Promise<unknown>)
          : null;
      return (
        <div
          aria-hidden={ariaHidden}
          data-camera-z={camera?.position?.[2]}
          data-frameloop={String(frameloop)}
          data-orthographic={String(orthographic)}
          data-testid="avatar-canvas"
        >
          {children}
        </div>
      );
    },
  };
});

function runtime() {
  return new AvatarRuntime(() => ({
    dock: { x: 900, y: 776 },
    obstacles: [],
    viewport: { width: 1_000, height: 800, floorY: 776 },
  }));
}

beforeEach(() => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  canvasMockState.gl = null;
});

afterEach(() => cleanup());

describe("AvatarOverlay", () => {
  it("renders one pointer-transparent orthographic canvas for a visible avatar", () => {
    const avatar = runtime();
    avatar.show();
    const { container } = render(<AvatarOverlay runtime={avatar} />);

    expect(container.querySelector(".avatar-overlay")).toBeTruthy();
    expect(screen.getByTestId("avatar-canvas").getAttribute("data-orthographic")).toBe("true");
    expect(Number(screen.getByTestId("avatar-canvas").getAttribute("data-camera-z"))).toBeGreaterThan(400);
    expect(screen.getByTestId("avatar-canvas").getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the canvas mounted when Brain Food moves the avatar", () => {
    const avatar = runtime();
    avatar.show();
    render(<AvatarOverlay runtime={avatar} />);
    const canvas = screen.getByTestId("avatar-canvas");

    act(() => {
      avatar.beginBrainFood({ x: 500, y: 400 });
      avatar.setBrainFoodPosition({ x: 520, y: 390 }, 0);
    });

    expect(screen.getByTestId("avatar-canvas")).toBe(canvas);
  });

  it("mounts no canvas before the avatar first shows", () => {
    render(<AvatarOverlay runtime={runtime()} />);

    expect(screen.queryByTestId("avatar-canvas")).toBeNull();
  });

  it("keeps the canvas mounted while hidden and pauses its frameloop", () => {
    const avatar = runtime();
    avatar.show();
    render(<AvatarOverlay runtime={avatar} />);
    const canvas = screen.getByTestId("avatar-canvas");
    const overlay = canvas.closest(".avatar-overlay")!;
    expect(overlay.hasAttribute("hidden")).toBe(false);

    act(() => avatar.hide());

    expect(screen.getByTestId("avatar-canvas")).toBe(canvas);
    expect(canvas.getAttribute("data-frameloop")).toBe("never");
    expect(overlay.hasAttribute("hidden")).toBe(true);

    act(() => avatar.show());

    expect(screen.getByTestId("avatar-canvas")).toBe(canvas);
    expect(canvas.getAttribute("data-frameloop")).toBe("always");
    expect(overlay.hasAttribute("hidden")).toBe(false);
  });

  it("renders a still avatar without a continuous frame loop for reduced motion", () => {
    const avatar = runtime(); avatar.show();
    render(<AvatarOverlay runtime={avatar} reducedMotion />);
    expect(screen.getByTestId("avatar-canvas").getAttribute("data-frameloop")).toBe("demand");
  });

  it("renders no public avatar controls", () => {
    const avatar = runtime();
    avatar.show();
    render(<AvatarOverlay runtime={avatar} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("removes only the failed avatar renderer", () => {
    const avatar = runtime();
    avatar.show();
    avatar.markFailed();
    render(<AvatarOverlay runtime={avatar} />);

    expect(screen.queryByTestId("avatar-canvas")).toBeNull();
  });

  it("turns renderer construction failure into runtime failure", async () => {
    const avatar = runtime();
    avatar.show();
    const createRenderer = vi.fn(() => {
      throw new Error("WebGL context unavailable");
    });
    render(<AvatarOverlay createRenderer={createRenderer} runtime={avatar} />);

    await act(async () => {
      void canvasMockState.gl?.({ canvas: document.createElement("canvas") });
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.queryByTestId("avatar-canvas")).toBeNull());
    expect(avatar.getSnapshot().failed).toBe(true);
  });

  it("pauses the canvas and cancels travel while the document is hidden", () => {
    const avatar = runtime();
    avatar.show();
    render(<AvatarOverlay runtime={avatar} />);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(screen.getByTestId("avatar-canvas").getAttribute("data-frameloop")).toBe("never");
    expect(avatar.getSnapshot().phase).toBe("idle");
  });

  it("pauses Brain Food without discarding the live game state", () => {
    const avatar = runtime();
    avatar.beginBrainFood({ x: 500, y: 400 });
    render(<AvatarOverlay runtime={avatar} />);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(screen.getByTestId("avatar-canvas").getAttribute("data-frameloop")).toBe("never");
    expect(avatar.getSnapshot().phase).toBe("brain-food");
  });
});
