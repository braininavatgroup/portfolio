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

  it("mounts once and docks a visible avatar inside the registered Guide avatar area", () => {
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
      position: { x: 504, y: 740 },
    });

    rerender({ open: false });
    expect(result.current.avatarRuntime.getSnapshot().visible).toBe(false);
  });

  it("uses the bottom center of the mobile avatar area as the dock", () => {
    vi.stubGlobal("innerWidth", 600);
    const { result, rerender } = renderHook(
      ({ open }) => useAvatarStage({ assistantOpen: open, reducedMotion: false }),
      { initialProps: { open: false } },
    );

    act(() => {
      result.current.registerAvatarStage(elementAt(0, 0, 600, 800));
      result.current.registerAvatarDock(elementAt(278, 488, 96, 96));
    });
    rerender({ open: true });

    expect(result.current.avatarRuntime.getSnapshot().position).toEqual({
      x: 326,
      y: 584,
    });
  });

  it("ignores a registered avatar area until layout gives it positive dimensions", () => {
    const { result, rerender } = renderHook(
      ({ open }) => useAvatarStage({ assistantOpen: open, reducedMotion: false }),
      { initialProps: { open: false } },
    );

    act(() => {
      result.current.registerAvatarDock(elementAt(0, 0, 0, 0));
    });
    rerender({ open: true });

    expect(result.current.avatarRuntime.getSnapshot().position).toEqual({
      x: 1_120,
      y: 776,
    });
  });

  it("re-docks on any Guide resize, not only the avatar area's", () => {
    const observed: Element[] = [];
    const original = globalThis.ResizeObserver;
    class SpyObserver {
      observe(target: Element) { observed.push(target); }
      disconnect() {}
      unobserve() {}
    }
    globalThis.ResizeObserver = SpyObserver as unknown as typeof ResizeObserver;
    try {
      const guide = document.createElement("section");
      guide.className = "portfolio-chat";
      const area = document.createElement("div");
      guide.appendChild(area);
      document.body.appendChild(guide);
      const { result } = renderHook(() => useAvatarStage({ assistantOpen: true, reducedMotion: true }));
      act(() => result.current.registerAvatarDock(area));
      expect(observed).toEqual([area, guide]);
      guide.remove();
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});

