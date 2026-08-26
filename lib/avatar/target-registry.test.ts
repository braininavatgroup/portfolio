import { describe, expect, it } from "vitest";
import type { AvatarTargetId } from "./contracts";
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

function elementAt(left: number, top: number, width: number, height: number) {
  return {
    getBoundingClientRect: () => rect(left, top, width, height),
  } as HTMLElement;
}

describe("avatar target registry", () => {
  it("reads live target bounds and derives the center point", () => {
    // Catches an unmounted target that could leave stale bounds.
    const registry = new AvatarTargetRegistry();
    const element = {
      getBoundingClientRect: () => rect(120, 40, 80, 160),
    } as HTMLElement;

    registry.register("hero", element);

    expect(registry.resolve("hero")?.centerX).toBe(160);
    expect(registry.resolve("hero")?.centerY).toBe(120);
  });

  it("unregisters the same mounted element and clears its semantic target", () => {
    // Catches an unmounted target that could leave stale bounds.
    const registry = new AvatarTargetRegistry();
    const element = {
      getBoundingClientRect: () => rect(40, 20, 20, 20),
    } as HTMLElement;

    registry.register("hero", element);
    registry.unregister("hero", element);

    expect(registry.resolve("hero")).toBeUndefined();
  });

  it("never caches a rectangle across resolve calls", () => {
    // Catches an unmounted target that could leave stale bounds.
    const registry = new AvatarTargetRegistry();
    let left = 20;
    const element = {
      getBoundingClientRect: () => rect(left, 10, 40, 40),
    } as HTMLElement;

    registry.register("hero", element);
    expect(registry.resolve("hero")?.left).toBe(20);

    left = 180;

    expect(registry.resolve("hero")?.left).toBe(180);
  });

  it("enumerates fresh bounds for every mounted semantic target", () => {
    // Catches collision avoidance seeing only the requested target or stale obstacle geometry.
    const registry = new AvatarTargetRegistry();
    let chatLeft = 300;
    registry.register("hero", {
      getBoundingClientRect: () => rect(40, 20, 120, 80),
    } as HTMLElement);
    registry.register("portfolio:chat", {
      getBoundingClientRect: () => rect(chatLeft, 500, 400, 160),
    } as HTMLElement);

    expect(registry.resolveAll().map(({ target, bounds }) => [target, bounds.left]))
      .toEqual([
        ["hero", 40],
        ["portfolio:chat", 300],
      ]);

    chatLeft = 360;
    expect(registry.resolveAll()[1]?.bounds.left).toBe(360);
  });

  it("keeps repository obstacles out of semantic targets", () => {
    const registry = new AvatarTargetRegistry();
    registry.registerObstacle("portfolio:header", elementAt(0, 0, 1_000, 72));

    expect(registry.resolve("portfolio:header" as AvatarTargetId)).toBeUndefined();
    expect(registry.resolveObstacles()).toEqual([
      expect.objectContaining({ obstacle: "portfolio:header" }),
    ]);
  });

  it("unregisters only when the exact registered element matches", () => {
    const registry = new AvatarTargetRegistry();
    const registered = elementAt(0, 0, 100, 50);
    const replacement = elementAt(10, 10, 100, 50);

    registry.registerObstacle("portfolio:header", registered);
    registry.unregisterObstacle("portfolio:header", replacement);
    expect(registry.resolveObstacles()).toHaveLength(1);

    registry.unregisterObstacle("portfolio:header", registered);
    expect(registry.resolveObstacles()).toHaveLength(0);
  });

  it("retains hidden and offscreen bounds while reporting them outside the viewport", () => {
    Object.assign(globalThis, { innerWidth: 800, innerHeight: 600 });
    const registry = new AvatarTargetRegistry();
    registry.registerObstacle("portfolio:header", elementAt(-200, 20, 100, 40));
    registry.registerObstacle("avatar:director-console", elementAt(100, 100, 0, 0));

    expect(registry.resolveObstacles()).toEqual([
      { obstacle: "portfolio:header", bounds: expect.objectContaining({ left: -200, inViewport: false }) },
      { obstacle: "avatar:director-console", bounds: expect.objectContaining({ left: 100, top: 100, width: 0, height: 0, inViewport: false }) },
    ]);
  });

  it("resolves a fresh stage map with current viewport and element rectangles", () => {
    let left = 30;
    Object.assign(globalThis, { innerWidth: 800, innerHeight: 600 });
    const registry = new AvatarTargetRegistry();
    registry.register("hero", elementAt(0, 40, 100, 100));
    registry.registerObstacle("portfolio:header", elementAt(0, 0, 800, 72));
    registry.registerObstacle("avatar:director-console", {
      getBoundingClientRect: () => rect(left, 400, 300, 160),
    } as HTMLElement);

    expect(registry.resolveStageMap()).toMatchObject({
      viewport: { width: 800, height: 600 },
      targets: [{ target: "hero" }],
      obstacles: [
        { obstacle: "portfolio:header" },
        { obstacle: "avatar:director-console", bounds: { left: 30 } },
      ],
    });

    Object.assign(globalThis, { innerWidth: 1024, innerHeight: 700 });
    left = 120;
    expect(registry.resolveStageMap()).toMatchObject({
      viewport: { width: 1024, height: 700 },
      obstacles: [{ obstacle: "portfolio:header" }, { obstacle: "avatar:director-console", bounds: { left: 120 } }],
    });
  });

  it("only exposes the expanded Director console as an active floor obstacle", () => {
    const registry = new AvatarTargetRegistry();
    const consoleElement = elementAt(400, 420, 400, 180);

    expect(registry.resolveObstacles()).toEqual([]);
    registry.registerObstacle("avatar:director-console", consoleElement);
    expect(registry.resolveStageMap().obstacles).toEqual([
      expect.objectContaining({ obstacle: "avatar:director-console", bounds: expect.objectContaining({ top: 420, bottom: 600 }) }),
    ]);

    registry.unregisterObstacle("avatar:director-console", consoleElement);
    expect(registry.resolveStageMap().obstacles).toEqual([]);
  });
});
