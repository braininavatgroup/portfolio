import { describe, expect, it } from "vitest";
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
});
