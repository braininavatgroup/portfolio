// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAvatarToyboxSession } from "./useAvatarToyboxSession";

const roster = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
];

function setViewport(width = 1200, height = 800) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

function dispatchShortcut(target: EventTarget = document, extras: KeyboardEventInit = {}) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "g",
      shiftKey: true,
      ...extras,
    }),
  );
}

beforeEach(() => {
  setViewport();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  const shell = document.createElement("div");
  shell.id = "app-shell";
  shell.setAttribute("aria-hidden", "false");
  const opener = document.createElement("button");
  opener.textContent = "Open context";
  shell.appendChild(opener);
  const main = document.createElement("main");
  main.id = "main-content";
  main.tabIndex = -1;
  shell.appendChild(main);
  document.body.appendChild(shell);
  document.body.appendChild(Object.assign(document.createElement("div"), { id: "avatar-toybox-root" }));
  opener.focus();
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("avatar toybox session lease", () => {
  it("acquires and restores the modal boundary exactly", () => {
    const { result, unmount } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: roster, reducedMotion: false }),
    );
    const opener = document.querySelector("button") as HTMLButtonElement;
    const shell = document.getElementById("app-shell")!;

    act(() => dispatchShortcut());
    expect(result.current.status).toBe("choosing");
    expect(shell.hasAttribute("inert")).toBe(true);
    expect(shell.getAttribute("aria-hidden")).toBe("true");

    const modal = document.createElement("div");
    const first = document.createElement("button");
    first.dataset.avatarToyboxInitialFocus = "true";
    const last = document.createElement("button");
    modal.appendChild(first);
    modal.appendChild(last);
    document.body.appendChild(modal);
    act(() => result.current.modalRef(modal));
    expect(document.activeElement).toBe(first);

    act(() => result.current.close());
    expect(result.current.status).toBe("closed");
    expect(shell.hasAttribute("inert")).toBe(false);
    expect(shell.getAttribute("aria-hidden")).toBe("false");
    expect(document.activeElement).toBe(opener);

    act(() => result.current.close());
    unmount();
    expect(shell.getAttribute("aria-hidden")).toBe("false");
  });

  it("rejects controls, unsupported viewports, and unavailable avatars", () => {
    const canOpen = vi.fn(() => false);
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen, collectibles: roster, reducedMotion: false }),
    );
    act(() => dispatchShortcut());
    expect(result.current.status).toBe("closed");

    canOpen.mockReturnValue(true);
    setViewport(719, 800);
    act(() => dispatchShortcut());
    expect(result.current.status).toBe("closed");

    setViewport();
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => dispatchShortcut(input));
    expect(result.current.status).toBe("closed");
  });

  it("falls back to main content when the remembered control becomes unfocusable", () => {
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: roster, reducedMotion: false }),
    );
    const opener = document.querySelector("button") as HTMLButtonElement;
    const main = document.getElementById("main-content")!;
    act(() => dispatchShortcut());
    const modal = document.createElement("div");
    const first = document.createElement("button");
    first.dataset.avatarToyboxInitialFocus = "true";
    modal.appendChild(first);
    document.body.appendChild(modal);
    act(() => result.current.modalRef(modal));
    opener.disabled = true;

    act(() => result.current.close());

    expect(document.activeElement).toBe(main);
  });

  it("owns chooser keys and closes on an unsupported resize", () => {
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: roster, reducedMotion: false }),
    );
    act(() => dispatchShortcut());
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })));
    expect(result.current.status).toBe("collecting");

    setViewport(700, 700);
    act(() => window.dispatchEvent(new Event("resize")));
    expect(result.current.status).toBe("closed");
  });

  it("clears held movement on blur and requires a fresh keydown", () => {
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: roster, reducedMotion: false }),
    );
    act(() => dispatchShortcut());
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })));
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(result.current.heldDirection).toEqual({ x: 1, y: 0 });

    act(() => window.dispatchEvent(new Event("blur")));
    expect(result.current.heldDirection).toEqual({ x: 0, y: 0 });
  });

  it("keeps release velocity when the expected lost-capture event arrives", () => {
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: roster, reducedMotion: false }),
    );
    const hitbox = document.createElement("div");
    hitbox.setPointerCapture = vi.fn();
    hitbox.hasPointerCapture = vi.fn(() => true);
    hitbox.releasePointerCapture = vi.fn();
    act(() => dispatchShortcut());
    act(() => result.current.startTossing());
    act(() => result.current.beginDrag(7, { x: 200, y: 300 }, hitbox, 0));
    act(() => result.current.moveDrag(7, { x: 300, y: 350 }, 100));
    act(() => result.current.endDrag(7, { x: 400, y: 400 }, 200));
    expect(result.current.tossBody.velocity.x).toBeGreaterThan(0);

    act(() => result.current.losePointerCapture(7));
    expect(result.current.tossBody.velocity.x).toBeGreaterThan(0);
  });

  it("preserves the point where the avatar was grabbed", () => {
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: roster, reducedMotion: false }),
    );
    const hitbox = document.createElement("div");
    hitbox.setPointerCapture = vi.fn();
    act(() => dispatchShortcut());
    act(() => result.current.startTossing());
    const initial = result.current.tossBody.position;

    act(() => result.current.beginDrag(7, { x: initial.x - 40, y: initial.y - 50 }, hitbox, 0));
    expect(result.current.tossBody.position).toEqual(initial);

    act(() => result.current.moveDrag(7, { x: initial.x + 60, y: initial.y }, 100));
    expect(result.current.tossBody.position).toEqual({ x: initial.x + 100, y: initial.y + 50 });
  });

  it("moves exactly one bounded step per reduced-motion keydown", () => {
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: roster, reducedMotion: true }),
    );
    act(() => dispatchShortcut());
    act(() => result.current.startCollecting());
    const before = result.current.brainBody.position.x;
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));

    expect(result.current.brainBody.position.x).toBe(before + 24);
    expect(result.current.heldDirection).toEqual({ x: 0, y: 0 });
  });

  it("advances normal movement through the session-owned animation frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: roster, reducedMotion: false }),
    );
    act(() => dispatchShortcut());
    act(() => result.current.startCollecting());
    expect(frames.length).toBeGreaterThan(0);
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    const before = result.current.brainBody.position.x;
    act(() => frames.shift()?.(0));
    act(() => frames.shift()?.(16));

    expect(result.current.brainBody.position.x).toBeGreaterThan(before);
  });

  it("settles Brain Food momentum while focus is lost", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: roster, reducedMotion: false }),
    );
    act(() => dispatchShortcut());
    act(() => result.current.startCollecting());
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    act(() => frames.shift()?.(0));
    act(() => frames.shift()?.(16));
    expect(result.current.brainBody.velocity.x).toBeGreaterThan(0);

    act(() => window.dispatchEvent(new Event("blur")));
    const settledX = result.current.brainBody.position.x;
    expect(result.current.brainBody.velocity).toEqual({ x: 0, y: 0 });
    expect(result.current.brainBody.moving).toBe(false);
    act(() => frames.shift()?.(32));
    expect(result.current.brainBody.position.x).toBe(settledX);
  });

  it("returns to the portfolio five seconds after showing a result", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: [], reducedMotion: false }),
    );
    act(() => dispatchShortcut());
    act(() => result.current.startCollecting());
    expect(result.current.status).toBe("result");

    act(() => vi.advanceTimersByTime(4_999));
    expect(result.current.status).toBe("result");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.status).toBe("closed");
  });

  it("completes Toss Bradley after the first real throw settles", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { result } = renderHook(() =>
      useAvatarToyboxSession({ canOpen: () => true, collectibles: roster, reducedMotion: true }),
    );
    const hitbox = document.createElement("div");
    hitbox.setPointerCapture = vi.fn();
    hitbox.hasPointerCapture = vi.fn(() => true);
    hitbox.releasePointerCapture = vi.fn();
    act(() => dispatchShortcut());
    act(() => result.current.startTossing());
    const initial = result.current.tossBody.position;
    act(() => result.current.beginDrag(7, initial, hitbox, 0));
    act(() => result.current.moveDrag(7, { x: initial.x + 120, y: initial.y + 40 }, 100));
    act(() => result.current.endDrag(7, { x: initial.x + 160, y: initial.y + 80 }, 180));
    expect(result.current.status).toBe("tossing");

    act(() => frames.shift()?.(0));
    expect(result.current.status).toBe("result");
  });
});
