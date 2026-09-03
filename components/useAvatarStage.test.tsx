// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAvatarStage } from "./useAvatarStage";

function elementAt(left: number, top: number, width: number, height: number) {
  return {
    getBoundingClientRect: () => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }),
  } as HTMLElement;
}

describe("useAvatarStage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("innerWidth", 1_200);
    vi.stubGlobal("innerHeight", 800);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("mounts once and places a visible avatar beside the registered chat", () => {
    const { result, rerender } = renderHook(
      ({ open }) => useAvatarStage({ assistantOpen: open, reducedMotion: false }),
      { initialProps: { open: false } },
    );

    act(() => {
      result.current.registerAvatarStage(elementAt(0, 0, 700, 800));
      result.current.registerAvatarDock(elementAt(360, 520, 288, 220));
      vi.runAllTimers();
    });
    expect(result.current.avatarMounted).toBe(true);

    rerender({ open: true });
    expect(result.current.avatarRuntime.getSnapshot()).toMatchObject({
      visible: true,
      phase: "idle",
      position: { x: 272, y: 776 },
    });

    rerender({ open: false });
    expect(result.current.avatarRuntime.getSnapshot().visible).toBe(false);
  });

  it("uses the top of the mobile chat shelf as the dock", () => {
    vi.stubGlobal("innerWidth", 600);
    const { result, rerender } = renderHook(
      ({ open }) => useAvatarStage({ assistantOpen: open, reducedMotion: false }),
      { initialProps: { open: false } },
    );

    act(() => {
      result.current.registerAvatarStage(elementAt(0, 0, 600, 800));
      result.current.registerAvatarDock(elementAt(0, 620, 600, 180));
    });
    rerender({ open: true });

    expect(result.current.avatarRuntime.getSnapshot().position).toEqual({
      x: 300,
      y: 620,
    });
  });
});
