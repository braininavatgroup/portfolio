import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarController } from "./controller";
import { AvatarTargetRegistry } from "./target-registry";

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("avatar controller", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1_000);
  });

  it("notifies subscribers once with a fresh snapshot for a state change", () => {
    // Catches a mutable snapshot that can make useSyncExternalStore miss an update.
    const controller = new AvatarController(new AvatarTargetRegistry());
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    const before = controller.getSnapshot();

    controller.execute({ action: "setState", state: "thinking" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      state: "thinking",
      animation: "think",
      currentCommand: { action: "setState", state: "thinking" },
    });
    expect(controller.getSnapshot()).not.toBe(before);

    unsubscribe();
    controller.execute({ action: "setState", state: "idle" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clamps a target walk anchor inside the safe horizontal viewport bounds", () => {
    // Catches a target rectangle that can position the overlay outside the viewport.
    const registry = new AvatarTargetRegistry();
    registry.register("hero", {
      getBoundingClientRect: () => rect(1_200, 0, 100, 40),
    } as HTMLElement);
    const controller = new AvatarController(registry);

    controller.execute({ action: "walkTo", target: "hero" });

    expect(controller.getSnapshot()).toMatchObject({
      target: "hero",
      anchorX: 920,
      facing: "right",
    });
  });

  it("uses the viewport midpoint when the normal 80 pixel bounds overlap", () => {
    // Catches a narrow viewport whose invalid 80..width-80 interval would place the avatar off-screen.
    vi.stubGlobal("innerWidth", 120);
    const registry = new AvatarTargetRegistry();
    registry.register("hero", {
      getBoundingClientRect: () => rect(500, 0, 40, 40),
    } as HTMLElement);
    const controller = new AvatarController(registry);

    controller.execute({ action: "walkTo", target: "hero" });

    expect(controller.getSnapshot().anchorX).toBe(60);
  });

  it("mirrors look and point poses from the target center", () => {
    // Catches look and point directions that ignore which side of the avatar owns the target.
    const registry = new AvatarTargetRegistry();
    registry.register("hero", {
      getBoundingClientRect: () => rect(120, 0, 80, 40),
    } as HTMLElement);
    const controller = new AvatarController(registry);

    controller.execute({ action: "lookAt", target: "hero" });
    expect(controller.getSnapshot().facing).toBe("left");

    registry.register("portfolio:chat", {
      getBoundingClientRect: () => rect(700, 0, 80, 40),
    } as HTMLElement);
    controller.execute({ action: "pointAt", target: "portfolio:chat" });

    expect(controller.getSnapshot()).toMatchObject({
      target: "portfolio:chat",
      facing: "right",
      pointing: "right",
    });
  });

  it("restores the initial snapshot when reset", () => {
    // Catches a reset that leaves a previous target, pose, or failure visible for the next chat turn.
    const registry = new AvatarTargetRegistry();
    const controller = new AvatarController(registry);
    const initial = controller.getSnapshot();

    controller.execute({ action: "setState", state: "talking" });
    controller.setVisible(false);
    controller.markFailed();
    controller.reset();

    expect(controller.getSnapshot()).toEqual(initial);
  });

  it("records renderer model failure without throwing", () => {
    // Catches a renderer failure that can escape the avatar boundary and break the portfolio.
    const controller = new AvatarController(new AvatarTargetRegistry());

    expect(() => controller.markFailed()).not.toThrow();
    expect(controller.getSnapshot().failed).toBe(true);
  });
});
