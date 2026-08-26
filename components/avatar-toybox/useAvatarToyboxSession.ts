"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isExactToyboxShortcut } from "../../lib/dom-keyboard";
import {
  advanceActiveTime,
  clampAvatarPosition,
  collectOverlaps,
  createCollectibleLayout,
  estimatePointerVelocity,
  integrateBrainFood,
  integrateToss,
  isToyboxViewportEligible,
  rebuildUneatenCollectibles,
  resetTossBody,
  type BrainFoodBody,
  type Collectible,
  type HitboxSize,
  type PointerSample,
  type TossBody,
  type Vec2,
  type ViewportBounds,
} from "../../lib/avatar-toybox/runtime";

export type ToyboxStatus = "closed" | "choosing" | "collecting" | "result" | "tossing";

export type ToyboxCollectible = {
  id: string;
  label: string;
  tokenKind?: string;
};

export type AvatarToyboxSession = {
  status: ToyboxStatus;
  isOpen: boolean;
  isPlaying: boolean;
  reducedMotion: boolean;
  collectibles: Collectible[];
  roster: readonly ToyboxCollectible[];
  brainBody: BrainFoodBody;
  tossBody: TossBody;
  elapsed: number;
  score: number;
  remainingSeconds: number;
  announcement: string;
  heldDirection: Vec2;
  modalRef: (element: HTMLElement | null) => void;
  close: (reason?: string) => void;
  startCollecting: () => void;
  startTossing: () => void;
  resetToss: () => void;
  setHitboxSize: (size: HitboxSize) => void;
  beginDrag: (id: number, position: Vec2, element: HTMLElement, at: number) => void;
  moveDrag: (id: number, position: Vec2, at: number) => void;
  endDrag: (id: number, position: Vec2, at: number) => void;
  cancelDrag: () => void;
  losePointerCapture: (id: number) => void;
};

type ShellLease = {
  shell: HTMLElement;
  hadInert: boolean;
  inertValue: string | null;
  inertProperty?: boolean;
  ariaHidden: string | null;
};

const INITIAL_HITBOX = { width: 144, height: 208 };
const FOCUSABLE = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function currentViewport(): ViewportBounds {
  return { width: window.innerWidth, height: window.innerHeight, hudHeight: 96, padding: 24 };
}

function initialBrainBody(bounds: ViewportBounds): BrainFoodBody {
  return {
    position: { x: bounds.width / 2, y: (bounds.hudHeight ?? 96) + (bounds.height - (bounds.hudHeight ?? 96)) / 2 },
    velocity: { x: 0, y: 0 },
    facing: "right",
    moving: false,
  };
}

function directionFromHeld(held: ReadonlySet<string>): Vec2 {
  return {
    x: Number(held.has("arrowright") || held.has("d")) - Number(held.has("arrowleft") || held.has("a")),
    y: Number(held.has("arrowdown") || held.has("s")) - Number(held.has("arrowup") || held.has("w")),
  };
}

export function useAvatarToyboxSession({
  canOpen,
  collectibles: roster,
  reducedMotion,
}: {
  canOpen: () => boolean;
  collectibles: readonly ToyboxCollectible[];
  reducedMotion: boolean;
}): AvatarToyboxSession {
  const [status, setStatus] = useState<ToyboxStatus>("closed");
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [brainBody, setBrainBody] = useState<BrainFoodBody>(() =>
    typeof window === "undefined"
      ? initialBrainBody({ width: 1200, height: 800, hudHeight: 96 })
      : initialBrainBody(currentViewport()),
  );
  const [tossBody, setTossBody] = useState<TossBody>(() =>
    typeof window === "undefined"
      ? resetTossBody({ width: 1200, height: 800, hudHeight: 96 })
      : resetTossBody(currentViewport()),
  );
  const [elapsed, setElapsed] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [heldDirection, setHeldDirection] = useState<Vec2>({ x: 0, y: 0 });
  const statusRef = useRef<ToyboxStatus>("closed");
  const collectiblesRef = useRef<Collectible[]>([]);
  const brainBodyRef = useRef(brainBody);
  const tossBodyRef = useRef(tossBody);
  const elapsedRef = useRef(0);
  const midpointAnnouncedRef = useRef(false);
  const heldRef = useRef(new Set<string>());
  const hitboxRef = useRef<HitboxSize>(INITIAL_HITBOX);
  const modalElementRef = useRef<HTMLElement | null>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const shellLeaseRef = useRef<ShellLease | null>(null);
  const closingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const previousFrameRef = useRef<number | null>(null);
  const pointerRef = useRef<{
    id: number;
    element: HTMLElement;
    samples: PointerSample[];
    offset: Vec2;
  } | null>(null);

  const commitStatus = useCallback((next: ToyboxStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const releasePointer = useCallback(() => {
    const pointer = pointerRef.current;
    pointerRef.current = null;
    if (pointer && pointer.element.hasPointerCapture?.(pointer.id)) {
      pointer.element.releasePointerCapture(pointer.id);
    }
  }, []);

  const cancelInput = useCallback(() => {
    heldRef.current.clear();
    setHeldDirection({ x: 0, y: 0 });
    releasePointer();
    setBrainBody((current) => {
      const next = {
        ...current,
        velocity: { x: 0, y: 0 },
        moving: false,
      };
      brainBodyRef.current = next;
      return next;
    });
    setTossBody((current) => {
      const next = { ...current, dragging: false, velocity: { x: 0, y: 0 }, angularVelocity: 0 };
      tossBodyRef.current = next;
      return next;
    });
  }, [releasePointer]);

  const restoreShell = useCallback(() => {
    const lease = shellLeaseRef.current;
    shellLeaseRef.current = null;
    if (!lease) return;
    if (typeof lease.inertProperty === "boolean" && "inert" in lease.shell) {
      lease.shell.inert = lease.inertProperty;
    }
    if (lease.hadInert) {
      lease.shell.setAttribute("inert", lease.inertValue ?? "");
    } else {
      lease.shell.removeAttribute("inert");
    }
    if (lease.ariaHidden === null) {
      lease.shell.removeAttribute("aria-hidden");
    } else {
      lease.shell.setAttribute("aria-hidden", lease.ariaHidden);
    }
  }, []);

  const close = useCallback((reason?: string) => {
    if (statusRef.current === "closed" || closingRef.current) return;
    closingRef.current = true;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    previousFrameRef.current = null;
    cancelInput();
    restoreShell();
    modalElementRef.current = null;
    commitStatus("closed");
    const fallback = document.getElementById("main-content");
    const focusTarget = priorFocusRef.current?.isConnected
      ? priorFocusRef.current
      : null;
    priorFocusRef.current = null;
    focusTarget?.focus();
    if (
      document.activeElement !== focusTarget &&
      fallback instanceof HTMLElement
    ) {
      fallback.focus();
    }
    if (reason) setAnnouncement(reason);
    closingRef.current = false;
  }, [cancelInput, commitStatus, restoreShell]);

  const acquireShell = useCallback(() => {
    const shell = document.getElementById("app-shell");
    if (!(shell instanceof HTMLElement)) return false;
    priorFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    shellLeaseRef.current = {
      shell,
      hadInert: shell.hasAttribute("inert"),
      inertValue: shell.getAttribute("inert"),
      inertProperty: "inert" in shell ? shell.inert : undefined,
      ariaHidden: shell.getAttribute("aria-hidden"),
    };
    shell.setAttribute("inert", "");
    if ("inert" in shell) shell.inert = true;
    shell.setAttribute("aria-hidden", "true");
    return true;
  }, []);

  const openChooser = useCallback(() => {
    if (statusRef.current !== "closed" || !canOpen() || document.hidden) return;
    const bounds = currentViewport();
    if (!isToyboxViewportEligible(bounds) || !acquireShell()) return;
    closingRef.current = false;
    setAnnouncement("Avatar toybox opened. Choose Brain Food or Toss Bradley.");
    commitStatus("choosing");
  }, [acquireShell, canOpen, commitStatus]);

  const startCollecting = useCallback(() => {
    cancelInput();
    const bounds = currentViewport();
    const nextCollectibles = createCollectibleLayout(roster.map(({ id }) => id), bounds);
    const nextBody = initialBrainBody(bounds);
    collectiblesRef.current = nextCollectibles;
    brainBodyRef.current = nextBody;
    elapsedRef.current = 0;
    midpointAnnouncedRef.current = false;
    setCollectibles(nextCollectibles);
    setBrainBody(nextBody);
    setElapsed(0);
    if (nextCollectibles.length === 0) {
      setAnnouncement("Brain Food has no collectibles available.");
      commitStatus("result");
    } else {
      setAnnouncement("Brain Food started.");
      commitStatus("collecting");
    }
  }, [cancelInput, commitStatus, roster]);

  const startTossing = useCallback(() => {
    cancelInput();
    const next = resetTossBody(currentViewport());
    tossBodyRef.current = next;
    setTossBody(next);
    setAnnouncement("Toss Bradley started.");
    commitStatus("tossing");
  }, [cancelInput, commitStatus]);

  const resetToss = useCallback(() => {
    cancelInput();
    const next = resetTossBody(currentViewport());
    tossBodyRef.current = next;
    setTossBody(next);
    setAnnouncement("Bradley reset.");
  }, [cancelInput]);

  const modalRef = useCallback((element: HTMLElement | null) => {
    modalElementRef.current = element;
    if (!element) return;
    const initial = element.querySelector<HTMLElement>("[data-avatar-toybox-initial-focus]");
    (initial ?? element).focus();
  }, []);

  useEffect(() => {
    const handleClosedKey = (event: KeyboardEvent) => {
      if (!isExactToyboxShortcut(event)) return;
      if (!canOpen() || document.hidden || !isToyboxViewportEligible(currentViewport())) return;
      event.preventDefault();
      openChooser();
    };
    document.addEventListener("keydown", handleClosedKey);
    return () => document.removeEventListener("keydown", handleClosedKey);
  }, [canOpen, openChooser]);

  useEffect(() => {
    if (status === "closed") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (closingRef.current) return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        event.preventDefault();
        close();
        return;
      }
      if (key === "tab") {
        const focusable = Array.from(modalElementRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      const current = statusRef.current;
      if (current === "choosing") {
        if (key === "1") {
          event.preventDefault();
          startCollecting();
        } else if (key === "2") {
          event.preventDefault();
          startTossing();
        }
        return;
      }
      if (current === "collecting") {
        if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
          event.preventDefault();
          if (reducedMotion) {
            const direction = {
              x: key === "arrowright" || key === "d" ? 1 : key === "arrowleft" || key === "a" ? -1 : 0,
              y: key === "arrowdown" || key === "s" ? 1 : key === "arrowup" || key === "w" ? -1 : 0,
            };
            const next = integrateBrainFood(
              brainBodyRef.current,
              direction,
              0,
              currentViewport(),
              hitboxRef.current,
              true,
            );
            brainBodyRef.current = next;
            setBrainBody(next);
          } else {
            heldRef.current.add(key);
            setHeldDirection(directionFromHeld(heldRef.current));
          }
        } else if (key === "2") {
          event.preventDefault();
          startTossing();
        }
        return;
      }
      if (current === "result") {
        if (key === "enter" || key === "1") {
          event.preventDefault();
          startCollecting();
        } else if (key === "2") {
          event.preventDefault();
          startTossing();
        }
        return;
      }
      if (current === "tossing") {
        if (key === "r") {
          event.preventDefault();
          resetToss();
        } else if (key === "1") {
          event.preventDefault();
          startCollecting();
        }
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      heldRef.current.delete(event.key.toLowerCase());
      setHeldDirection(directionFromHeld(heldRef.current));
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [close, reducedMotion, resetToss, startCollecting, startTossing, status]);

  useEffect(() => {
    if (status === "closed") return;
    const handleResize = () => {
      const bounds = currentViewport();
      if (!isToyboxViewportEligible(bounds)) {
        close("Avatar toybox closed because the viewport became too small.");
        return;
      }
      setCollectibles((current) => {
        const next = rebuildUneatenCollectibles(current, bounds);
        collectiblesRef.current = next;
        return next;
      });
      setTossBody((current) => {
        const next = integrateToss(current, 0, bounds, hitboxRef.current, true);
        tossBodyRef.current = next;
        return next;
      });
    };
    const suspend = () => cancelInput();
    const visibility = () => {
      if (document.hidden) suspend();
      previousFrameRef.current = null;
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("blur", suspend);
    window.addEventListener("focus", suspend);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("blur", suspend);
      window.removeEventListener("focus", suspend);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [cancelInput, close, status]);

  useEffect(() => {
    if (status !== "collecting" && status !== "tossing") return;
    const tick = (now: number) => {
      const previous = previousFrameRef.current ?? now;
      const delta = (now - previous) / 1000;
      previousFrameRef.current = now;
      const bounds = currentViewport();
      if (statusRef.current === "collecting") {
        const moved = integrateBrainFood(
          brainBodyRef.current,
          directionFromHeld(heldRef.current),
          delta,
          bounds,
          hitboxRef.current,
          reducedMotion,
        );
        const collision = collectOverlaps(
          collectiblesRef.current,
          moved.position,
          Math.min(hitboxRef.current.width, hitboxRef.current.height) * 0.3,
        );
        const time = advanceActiveTime(elapsedRef.current, delta, {
          focused: document.hasFocus(),
          visible: !document.hidden,
        });
        brainBodyRef.current = moved;
        collectiblesRef.current = collision.collectibles;
        elapsedRef.current = time.elapsed;
        setBrainBody(moved);
        setCollectibles(collision.collectibles);
        setElapsed(time.elapsed);
        const allCollected = collision.collectibles.every(({ eaten }) => eaten);
        const score = collision.collectibles.filter(({ eaten }) => eaten).length;
        const midpoint = Math.ceil(collision.collectibles.length / 2);
        if (!allCollected && !midpointAnnouncedRef.current && score >= midpoint) {
          midpointAnnouncedRef.current = true;
          setAnnouncement(`Brain Food midpoint. ${score} of ${collision.collectibles.length} collected.`);
        }
        if (time.complete || allCollected) {
          setAnnouncement(`Brain Food complete. ${score} collected.`);
          commitStatus("result");
          return;
        }
      } else if (statusRef.current === "tossing") {
        const next = integrateToss(tossBodyRef.current, delta, bounds, hitboxRef.current, reducedMotion);
        tossBodyRef.current = next;
        setTossBody(next);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      previousFrameRef.current = null;
    };
  }, [commitStatus, reducedMotion, status]);

  useEffect(() => () => {
    if (statusRef.current !== "closed") close();
  }, [close]);

  const setHitboxSize = useCallback((size: HitboxSize) => {
    if (size.width > 0 && size.height > 0) hitboxRef.current = size;
  }, []);

  const beginDrag = useCallback((id: number, position: Vec2, element: HTMLElement, at: number) => {
    if (statusRef.current !== "tossing") return;
    cancelInput();
    element.setPointerCapture?.(id);
    const bodyPosition = clampAvatarPosition(
      tossBodyRef.current.position,
      currentViewport(),
      hitboxRef.current,
    );
    pointerRef.current = {
      id,
      element,
      samples: [{ position: bodyPosition, at }],
      offset: {
        x: bodyPosition.x - position.x,
        y: bodyPosition.y - position.y,
      },
    };
    const next = {
      ...tossBodyRef.current,
      position: bodyPosition,
      velocity: { x: 0, y: 0 },
      angularVelocity: 0,
      dragging: true,
      impact: 0,
    };
    tossBodyRef.current = next;
    setTossBody(next);
  }, [cancelInput]);

  const moveDrag = useCallback((id: number, position: Vec2, at: number) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== id) return;
    const bounded = clampAvatarPosition(
      { x: position.x + pointer.offset.x, y: position.y + pointer.offset.y },
      currentViewport(),
      hitboxRef.current,
    );
    pointer.samples = [...pointer.samples, { position: bounded, at }].slice(-8);
    const next = { ...tossBodyRef.current, position: bounded, dragging: true };
    tossBodyRef.current = next;
    setTossBody(next);
  }, []);

  const endDrag = useCallback((id: number, position: Vec2, at: number) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== id) return;
    const bounded = clampAvatarPosition(
      { x: position.x + pointer.offset.x, y: position.y + pointer.offset.y },
      currentViewport(),
      hitboxRef.current,
    );
    const velocity = reducedMotion
      ? { x: 0, y: 0 }
      : estimatePointerVelocity([...pointer.samples, { position: bounded, at }]);
    releasePointer();
    const next = {
      ...tossBodyRef.current,
      position: bounded,
      velocity,
      angularVelocity: reducedMotion ? 0 : Math.max(-7, Math.min(7, velocity.x / 180)),
      dragging: false,
      impact: 0,
    };
    tossBodyRef.current = next;
    setTossBody(next);
  }, [reducedMotion, releasePointer]);

  const losePointerCapture = useCallback((id: number) => {
    if (pointerRef.current?.id === id) cancelInput();
  }, [cancelInput]);

  return {
    status,
    isOpen: status !== "closed",
    isPlaying: status === "collecting" || status === "result" || status === "tossing",
    reducedMotion,
    collectibles,
    roster,
    brainBody,
    tossBody,
    elapsed,
    score: collectibles.filter(({ eaten }) => eaten).length,
    remainingSeconds: Math.max(0, Math.ceil(30 - elapsed)),
    announcement,
    modalRef,
    close,
    startCollecting,
    startTossing,
    resetToss,
    setHitboxSize,
    beginDrag,
    moveDrag,
    endDrag,
    cancelDrag: cancelInput,
    losePointerCapture,
    heldDirection,
  };
}
