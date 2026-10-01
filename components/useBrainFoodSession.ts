"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isExactShiftShortcut } from "../lib/dom-keyboard";
import {
  collectBrainFoodNodes,
  findBrainFoodSpawn,
  integrateBrainFood,
  isBrainFoodComplete,
  type BrainFoodBody,
  type BrainFoodBounds,
  type BrainFoodNodePosition,
} from "../lib/avatar/brain-food";
import type { AvatarRuntime } from "../lib/avatar/runtime";

const movementKeys = new Set([
  "arrowleft",
  "arrowright",
  "arrowup",
  "arrowdown",
  "a",
  "d",
  "w",
  "s",
]);
const avatarCollisionRadius = 78;
const avatarBoundsPadding = 96;
const pointerDirections = ["pointerleft", "pointerright", "pointerup", "pointerdown"];

function playBounds(): BrainFoodBounds {
  const world = document.querySelector<HTMLElement>(".portfolio-world");
  const rect = world?.getBoundingClientRect();
  return {
    left: rect?.left ?? 0,
    top: rect?.top ?? 0,
    width: rect && rect.width > 0 ? rect.width : window.innerWidth,
    height: rect && rect.height > 0 ? rect.height : window.innerHeight,
    padding: Math.min(avatarBoundsPadding, (rect?.width || window.innerWidth) * 0.15, (rect?.height || window.innerHeight) * 0.15),
  };
}

function directionFromHeld(held: ReadonlySet<string>) {
  return {
    x:
      Number(held.has("arrowright") || held.has("d") || held.has("pointerright")) -
      Number(held.has("arrowleft") || held.has("a") || held.has("pointerleft")),
    y:
      Number(held.has("arrowdown") || held.has("s") || held.has("pointerdown")) -
      Number(held.has("arrowup") || held.has("w") || held.has("pointerup")),
  };
}

export function useBrainFoodSession({
  avatarRuntime,
  edibleNodeCount,
  enabled,
  reducedMotion,
}: {
  avatarRuntime: AvatarRuntime;
  edibleNodeCount: number;
  enabled: boolean;
  reducedMotion: boolean;
}) {
  const [active, setActive] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const preparingRef = useRef(false);
  const focusBeforePlay = useRef<HTMLElement | null>(null);
  const sessionId = useRef(0);
  const [eatenIds, setEatenIds] = useState<ReadonlySet<string>>(new Set());
  const activeRef = useRef(false);
  const completingRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const heldRef = useRef(new Set<string>());
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const bodyRef = useRef<BrainFoodBody>({
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    heading: 0,
  });
  const eatenRef = useRef<ReadonlySet<string>>(new Set());
  const nodesRef = useRef<readonly BrainFoodNodePosition[]>([]);
  const previousFrameRef = useRef<number | null>(null);

  const restore = useCallback(() => {
    activeRef.current = false;
    preparingRef.current = false;
    setPreparing(false);
    sessionId.current += 1;
    completingRef.current = false;
    heldRef.current.clear();
    pointerRef.current = null;
    previousFrameRef.current = null;
    setActive(false);
    if (wasVisibleRef.current) avatarRuntime.show();
    else avatarRuntime.hide();
    const focus = focusBeforePlay.current;
    const restoredSession = sessionId.current;
    window.requestAnimationFrame(() => {
      if (sessionId.current === restoredSession && focus?.isConnected) focus.focus();
    });
  }, [avatarRuntime]);

  const cancel = useCallback(() => {
    if (!activeRef.current && !preparingRef.current) return;
    avatarRuntime.cancel();
    restore();
  }, [avatarRuntime, restore]);

  useEffect(() => {
    if (!enabled || reducedMotion) cancel();
  }, [cancel, enabled, reducedMotion]);

  const begin = useCallback(() => {
    if (
      !enabled || reducedMotion ||
      activeRef.current ||
      avatarRuntime.getSnapshot().failed
    ) {
      restore();
      return;
    }
    const bounds = playBounds();
    const position = findBrainFoodSpawn(
      nodesRef.current,
      bounds,
      avatarCollisionRadius,
    );
    if (!position) { restore(); return; }
    preparingRef.current = false;
    setPreparing(false);
    bodyRef.current = {
      position,
      velocity: { x: 0, y: 0 },
      heading: 0,
    };
    eatenRef.current = new Set();
    completingRef.current = false;
    previousFrameRef.current = null;
    activeRef.current = true;
    setEatenIds(eatenRef.current);
    setActive(true);
    avatarRuntime.beginBrainFood(position);
    document.querySelector<HTMLElement>(".portfolio-world")?.focus();
  }, [avatarRuntime, enabled, reducedMotion, restore]);

  const start = useCallback(() => {
    if (!enabled || reducedMotion || activeRef.current || preparingRef.current || avatarRuntime.getSnapshot().failed) return false;
    sessionId.current += 1;
    wasVisibleRef.current = avatarRuntime.getSnapshot().visible;
    focusBeforePlay.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusBeforePlay.current?.blur();
    preparingRef.current = true;
    setPreparing(true);
    return true;
  }, [avatarRuntime, enabled, reducedMotion]);

  useEffect(() => {
    if (!preparing) return;
    // Let the temporary layout and the Map ResizeObserver publish before spawn.
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        if (preparingRef.current) begin();
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [begin, preparing]);

  const syncNodePositions = useCallback(
    (nodes: readonly BrainFoodNodePosition[]) => {
      nodesRef.current = nodes;
    },
    [],
  );

  const collectAtCurrentPosition = useCallback((previousPosition = bodyRef.current.position) => {
    if (!activeRef.current || completingRef.current) return;
    const collected = collectBrainFoodNodes(
      nodesRef.current,
      eatenRef.current,
      bodyRef.current.position,
      avatarCollisionRadius,
      previousPosition,
    );
    if (collected.length === 0) return;
    const next = new Set(eatenRef.current);
    for (const id of collected) next.add(id);
    eatenRef.current = next;
    setEatenIds(next);
    if (
      next.size >= edibleNodeCount &&
      isBrainFoodComplete(nodesRef.current, next)
    ) {
      completingRef.current = true;
      heldRef.current.clear();
      const completionSession = sessionId.current;
      void avatarRuntime.completeBrainFood().then(() => {
        if (sessionId.current === completionSession) restore();
      });
    }
  }, [avatarRuntime, edibleNodeCount, restore]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = (timestamp: number) => {
      if (!activeRef.current || completingRef.current) return;
      const previous = previousFrameRef.current;
      previousFrameRef.current = timestamp;
      const elapsed = previous === null ? 0 : (timestamp - previous) / 1_000;
      const previousPosition = bodyRef.current.position;
      bodyRef.current = integrateBrainFood(
        bodyRef.current,
        directionFromHeld(heldRef.current),
        elapsed,
        playBounds(),
        reducedMotion,
      );
      avatarRuntime.setBrainFoodPosition(
        bodyRef.current.position,
        bodyRef.current.heading,
        Math.hypot(bodyRef.current.velocity.x, bodyRef.current.velocity.y),
      );
      if (
        bodyRef.current.position.x !== previousPosition.x ||
        bodyRef.current.position.y !== previousPosition.y
      ) {
        collectAtCurrentPosition(previousPosition);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, avatarRuntime, collectAtCurrentPosition, reducedMotion]);

  useEffect(() => {
    if (!active) return;
    const world = document.querySelector<HTMLElement>(".portfolio-world");
    if (!world) return;
    const clearPointer = () => {
      pointerRef.current = null;
      for (const direction of pointerDirections) heldRef.current.delete(direction);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || pointerRef.current) return;
      pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      world.setPointerCapture?.(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.id !== event.pointerId) return;
      for (const direction of pointerDirections) heldRef.current.delete(direction);
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.abs(dx) > 12) heldRef.current.add(dx > 0 ? "pointerright" : "pointerleft");
      if (Math.abs(dy) > 12) heldRef.current.add(dy > 0 ? "pointerdown" : "pointerup");
    };
    const up = (event: PointerEvent) => {
      if (pointerRef.current?.id === event.pointerId) clearPointer();
    };
    world.addEventListener("pointerdown", down);
    world.addEventListener("pointermove", move);
    world.addEventListener("pointerup", up);
    world.addEventListener("pointercancel", up);
    world.addEventListener("lostpointercapture", clearPointer);
    return () => {
      clearPointer();
      world.removeEventListener("pointerdown", down);
      world.removeEventListener("pointermove", move);
      world.removeEventListener("pointerup", up);
      world.removeEventListener("pointercancel", up);
      world.removeEventListener("lostpointercapture", clearPointer);
    };
  }, [active]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (preparingRef.current && event.key === "Escape") {
        event.preventDefault();
        cancel();
        return;
      }
      if (!activeRef.current) {
        if (isExactShiftShortcut(event, "g")) {
          event.preventDefault();
          start();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
        return;
      }
      const key = event.key.toLowerCase();
      if (!movementKeys.has(key)) return;
      event.preventDefault();
      if (reducedMotion) {
        const previousPosition = bodyRef.current.position;
        bodyRef.current = integrateBrainFood(
          bodyRef.current,
          directionFromHeld(new Set([key])),
          0,
          playBounds(),
          true,
        );
        avatarRuntime.setBrainFoodPosition(
          bodyRef.current.position,
          bodyRef.current.heading,
        );
        if (
          bodyRef.current.position.x !== previousPosition.x ||
          bodyRef.current.position.y !== previousPosition.y
        ) {
          collectAtCurrentPosition(previousPosition);
        }
      } else {
        heldRef.current.add(key);
      }
    };
    const keyup = (event: KeyboardEvent) => {
      heldRef.current.delete(event.key.toLowerCase());
    };
    const clearInput = () => {
      heldRef.current.clear();
      bodyRef.current = {
        ...bodyRef.current,
        velocity: { x: 0, y: 0 },
      };
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("keyup", keyup);
    document.addEventListener("visibilitychange", clearInput);
    window.addEventListener("blur", clearInput);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("keyup", keyup);
      document.removeEventListener("visibilitychange", clearInput);
      window.removeEventListener("blur", clearInput);
    };
  }, [avatarRuntime, cancel, collectAtCurrentPosition, reducedMotion, start]);

  useEffect(() => () => cancel(), [cancel]);

  return useMemo(
    () => ({
      active,
      gameMode: active || preparing,
      cancel,
      eatenIds,
      remaining: Math.max(0, edibleNodeCount - eatenIds.size),
      start,
      syncNodePositions,
    }),
    [active, preparing, cancel, eatenIds, edibleNodeCount, start, syncNodePositions],
  );
}
