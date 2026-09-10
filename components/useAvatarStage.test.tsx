// @vitest-environment jsdom

import { act, render, renderHook } from "@testing-library/react";
import { useLayoutEffect } from "react";
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

  it("settles avatar visibility before the browser measures a pane switch", () => {
    const observations: boolean[] = [];
    const { rerender } = renderHook(({ open }) => {
      const { avatarRuntime } = useAvatarStage({ assistantOpen: open, reducedMotion: false });
      useLayoutEffect(() => {
        observations.push(avatarRuntime.getSnapshot().visible);
      }, [avatarRuntime, open]);
    }, { initialProps: { open: true } });
    rerender({ open: false });
    expect(observations).toEqual([true, false]);
  });

  it("uses the registered dock on the first visible layout, before passive effects", () => {
    const observations: { x: number; y: number }[] = [];
    function FirstVisibleStage() {
      const { avatarRuntime, registerAvatarDock } = useAvatarStage({ assistantOpen: true, reducedMotion: false });
      useLayoutEffect(() => {
        observations.push(avatarRuntime.getSnapshot().position);
      }, [avatarRuntime]);
      return <div ref={(element) => {
        if (element) element.getBoundingClientRect = elementAt(278, 488, 96, 96).getBoundingClientRect;
        registerAvatarDock(element);
      }} />;
    }

    render(<FirstVisibleStage />);

    expect(observations).toEqual([{ x: 326, y: 584 }]);
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

  it.each([1440, 1041])("swims out of the right Guide with a map ending at %i", async (mapRight) => {
    vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
    const reader = document.createElement("section"); reader.className = "portfolio-reader";
    reader.getBoundingClientRect = elementAt(320, 40, 721, 860).getBoundingClientRect;
    document.body.appendChild(reader);
    const { result } = renderHook(() => useAvatarStage({ assistantOpen: true, reducedMotion: false }));
    try {
      act(() => {
        result.current.registerAvatarStage(elementAt(320, 40, mapRight - 320, 320));
        result.current.registerAvatarDock(elementAt(1066, 424, 350, 136));
        void result.current.avatarRuntime.queueSwimLap();
      });
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      const snapshot = result.current.avatarRuntime.getSnapshot();
      expect(snapshot.phase).toBe("swimming");
      expect(snapshot.motion!.points.some(point => point.y < 424)).toBe(true);
      // The route can cross its own empty avatar area, but still clears Reader.
      expect(snapshot.motion!.points.every(point => point.x >= 1129)).toBe(true);
      await act(async () => { await vi.runAllTimersAsync(); });
      expect(result.current.avatarRuntime.getSnapshot()).toMatchObject({ phase: "idle", position: { x: 1241, y: 560 } });
    } finally { reader.remove(); }
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
