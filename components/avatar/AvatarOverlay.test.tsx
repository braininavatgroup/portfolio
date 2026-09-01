// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarController } from "../../lib/avatar/controller";
import { AvatarTargetRegistry } from "../../lib/avatar/target-registry";
import { AvatarOverlay } from "./AvatarOverlay";

type CanvasMockProps = {
  children?: React.ReactNode;
  "aria-hidden"?: React.AriaAttributes["aria-hidden"];
  camera?: { position?: readonly [number, number, number] };
  frameloop?: string;
  gl?: unknown;
  orthographic?: boolean;
  style?: React.CSSProperties;
};

const avatarDirectorConsoleLoad = vi.hoisted(() => vi.fn());
const canvasMockState = vi.hoisted(() => ({
  gl: null as null | ((props: unknown) => Promise<unknown>),
}));

vi.mock("./AvatarDirectorConsole", () => {
  avatarDirectorConsoleLoad();
  return { AvatarDirectorConsole: () => <h2>Director console</h2> };
});

vi.mock("./AvatarStageActor", () => ({
  AvatarStageActor: () => <div data-testid="avatar-stage-actor" />,
}));

vi.mock("@react-three/fiber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/fiber")>();
  return {
    ...actual,
    Canvas: ({ children, "aria-hidden": ariaHidden, camera, frameloop, gl, orthographic, style }: CanvasMockProps) => {
      canvasMockState.gl = typeof gl === "function"
        ? gl as (props: unknown) => Promise<unknown>
        : null;
      return (
        <div
          aria-hidden={ariaHidden}
          data-camera-z={camera?.position?.[2]}
          data-frameloop={String(frameloop)}
          data-orthographic={String(orthographic)}
          data-testid="avatar-canvas"
          style={style}
        >
          {children}
        </div>
      );
    },
  };
});

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1_000);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  avatarDirectorConsoleLoad.mockClear();
  canvasMockState.gl = null;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AvatarOverlay", () => {
  it("keeps one pointer-transparent orthographic canvas in a fixed full-stage wrapper", () => {
    const controller = new AvatarController(new AvatarTargetRegistry());
    const { container } = render(
      <AvatarOverlay controller={controller} enabled onEnabledChange={() => {}} />,
    );

    const overlay = container.querySelector<HTMLElement>(".avatar-overlay");
    const canvas = screen.getByTestId("avatar-canvas");
    expect(overlay?.getAttribute("style")).toContain("pointer-events: none");
    expect(overlay?.style.left).toBe("");
    expect(overlay?.style.pointerEvents).toBe("none");
    expect(canvas.getAttribute("data-orthographic")).toBe("true");
    // Some authored clips move hundreds of world units along their root Z track.
    // Keep the orthographic camera beyond them so those poses cannot cross its plane.
    expect(Number(canvas.getAttribute("data-camera-z"))).toBeGreaterThan(400);
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect((canvas as HTMLElement).style.pointerEvents).toBe("none");
  });

  it("keeps the canvas mounted when controller travel changes", () => {
    const registry = new AvatarTargetRegistry();
    registry.register("hero", { getBoundingClientRect: () => rect(80, 100, 120, 80) } as HTMLElement);
    const controller = new AvatarController(registry);
    render(<AvatarOverlay controller={controller} enabled onEnabledChange={() => {}} />);
    const canvas = screen.getByTestId("avatar-canvas");

    act(() => { void controller.execute({ action: "walkTo", target: "hero" }); });

    expect(screen.getByTestId("avatar-canvas")).toBe(canvas);
  });

  it("reports controller visibility changes to the shared assistant state", async () => {
    // Catches an exit command hiding the avatar while the chat panel stays open.
    const controller = new AvatarController(new AvatarTargetRegistry());
    const onEnabledChange = vi.fn();
    render(
      <AvatarOverlay
        controller={controller}
        enabled
        onEnabledChange={onEnabledChange}
      />,
    );

    act(() => controller.setVisible(false));

    await waitFor(() => expect(onEnabledChange).toHaveBeenCalledWith(false));
  });

  it("renders no public avatar visibility or recovery control", () => {
    const controller = new AvatarController(new AvatarTargetRegistry());
    render(<AvatarOverlay controller={controller} enabled onEnabledChange={() => {}} />);

    expect(screen.queryByRole("button", { name: "Hide assistant" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show assistant" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset assistant" })).toBeNull();
  });

  it("leaves toggle visibility to the Director console in development debug mode", async () => {
    const controller = new AvatarController(new AvatarTargetRegistry());
    render(
      <AvatarOverlay
        controller={controller}
        director={{} as never}
        enabled
        development
        debug
        onEnabledChange={() => {}}
        registry={new AvatarTargetRegistry()}
        runner={{} as never}
        siteActionExecutor={{} as never}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Director console" })).toBeTruthy();
    expect(document.querySelector(".avatar-overlay-toggle")).toBeNull();
  });

  it("removes a failed renderer without adding a public recovery pill", () => {
    const controller = new AvatarController(new AvatarTargetRegistry());
    controller.markFailed();
    render(<AvatarOverlay controller={controller} enabled onEnabledChange={() => {}} />);

    expect(screen.queryByTestId("avatar-canvas")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset assistant" })).toBeNull();
  });

  it("turns renderer construction failure into recoverable failed state", async () => {
    const controller = new AvatarController(new AvatarTargetRegistry());
    const createRenderer = vi.fn(() => {
      throw new Error("WebGL context unavailable");
    });
    render(
      <AvatarOverlay
        controller={controller}
        createRenderer={createRenderer}
        enabled
        onEnabledChange={() => {}}
      />,
    );

    expect(screen.getByTestId("avatar-canvas")).toBeTruthy();
    await act(async () => {
      void canvasMockState.gl?.({ canvas: document.createElement("canvas") });
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.queryByTestId("avatar-canvas")).toBeNull());
    expect(controller.getSnapshot().failed).toBe(true);
    expect(screen.queryByRole("button", { name: "Reset assistant" })).toBeNull();
  });

  it("stops directed travel and pauses the renderer when the document is hidden", () => {
    const controller = new AvatarController(new AvatarTargetRegistry());
    const director = { stop: vi.fn() };
    render(
      <AvatarOverlay
        controller={controller}
        director={director as never}
        enabled
        onEnabledChange={() => {}}
      />,
    );

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(director.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("avatar-canvas").getAttribute("data-frameloop")).toBe("never");
  });
});
