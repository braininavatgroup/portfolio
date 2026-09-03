// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BRAIN_FOOD_CELEBRATION_MS, AvatarRuntime } from "../lib/avatar/runtime";
import { useBrainFoodSession } from "./useBrainFoodSession";

const frames: FrameRequestCallback[] = [];

function runtime(visible = false) {
  const avatar = new AvatarRuntime(() => ({
    dock: { x: 820, y: 676 },
    obstacles: [],
    viewport: { width: 900, height: 700, floorY: 676 },
  }));
  if (visible) avatar.show();
  return avatar;
}

function shortcut(extras: KeyboardEventInit = {}) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "g",
      shiftKey: true,
      ...extras,
    }),
  );
}

describe("useBrainFoodSession", () => {
  beforeEach(() => {
    frames.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal("innerWidth", 1_200);
    vi.stubGlobal("innerHeight", 700);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("starts directly from exact Shift+G and restores a previously hidden avatar", () => {
    const avatar = runtime(false);
    const { result } = renderHook(() =>
      useBrainFoodSession({
        avatarRuntime: avatar,
        edibleNodeCount: 2,
        enabled: true,
        reducedMotion: false,
      }),
    );

    act(() => shortcut());
    expect(result.current.active).toBe(true);
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "brain-food",
      animation: "swim_forward",
      visible: true,
    });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    });
    expect(result.current.active).toBe(false);
    expect(avatar.getSnapshot().visible).toBe(false);
  });

  it("rejects modified shortcuts and unavailable or mobile starts", () => {
    const avatar = runtime();
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useBrainFoodSession({
          avatarRuntime: avatar,
          edibleNodeCount: 2,
          enabled,
          reducedMotion: false,
        }),
      { initialProps: { enabled: false } },
    );

    act(() => shortcut());
    expect(result.current.active).toBe(false);

    rerender({ enabled: true });
    act(() => shortcut({ metaKey: true }));
    expect(result.current.active).toBe(false);

    vi.stubGlobal("innerWidth", 900);
    act(() => shortcut());
    expect(result.current.active).toBe(false);
  });

  it("uses the original movement keys to steer the live avatar", () => {
    const avatar = runtime();
    const { result } = renderHook(() =>
      useBrainFoodSession({
        avatarRuntime: avatar,
        edibleNodeCount: 2,
        enabled: true,
        reducedMotion: false,
      }),
    );
    act(() => shortcut());
    const before = avatar.getSnapshot().position.x;

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
      );
      frames.shift()?.(0);
      frames.shift()?.(50);
    });

    expect(avatar.getSnapshot().position.x).toBeGreaterThan(before);
    expect(result.current.active).toBe(true);
  });

  it("starts in a clear part of the published node field", () => {
    const avatar = runtime();
    const { result } = renderHook(() =>
      useBrainFoodSession({
        avatarRuntime: avatar,
        edibleNodeCount: 1,
        enabled: true,
        reducedMotion: false,
      }),
    );
    act(() => {
      result.current.syncNodePositions([
        { id: "center-node", x: 600, y: 350, radius: 30 },
      ]);
      shortcut();
    });

    const spawn = avatar.getSnapshot().position;
    expect(Math.hypot(spawn.x - 600, spawn.y - 350)).toBeGreaterThan(108);
    expect(result.current.eatenIds).toEqual(new Set());
  });

  it("does not award a node until the visitor actually swims", () => {
    const avatar = runtime();
    const { result } = renderHook(() =>
      useBrainFoodSession({
        avatarRuntime: avatar,
        edibleNodeCount: 1,
        enabled: true,
        reducedMotion: false,
      }),
    );
    act(() => shortcut());
    const spawn = avatar.getSnapshot().position;
    act(() => {
      result.current.syncNodePositions([
        { id: "unexpected-overlap", x: spawn.x, y: spawn.y, radius: 22 },
      ]);
      frames.shift()?.(0);
    });

    expect(result.current.eatenIds).toEqual(new Set());
    expect(avatar.getSnapshot().phase).toBe("brain-food");
  });

  it("eats live map nodes and restores after the completion celebration", async () => {
    const avatar = runtime(true);
    const { result } = renderHook(() =>
      useBrainFoodSession({
        avatarRuntime: avatar,
        edibleNodeCount: 1,
        enabled: true,
        reducedMotion: false,
      }),
    );
    act(() => shortcut());
    const position = avatar.getSnapshot().position;
    act(() => {
      result.current.syncNodePositions([
        { id: "bradley", x: 50, y: 50, radius: 20 },
        { id: "dubs", x: position.x + 90, y: position.y, radius: 22 },
      ]);
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
      );
      frames.shift()?.(0);
      frames.shift()?.(50);
    });

    expect(result.current.eatenIds).toEqual(new Set(["dubs"]));
    expect(result.current.active).toBe(true);
    expect(avatar.getSnapshot().phase).toBe("celebrating");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BRAIN_FOOD_CELEBRATION_MS);
    });
    expect(result.current.active).toBe(false);
    expect(avatar.getSnapshot()).toMatchObject({ visible: true, phase: "idle" });
  });
});
