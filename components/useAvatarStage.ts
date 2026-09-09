"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AvatarRuntime,
  type AvatarStageGeometry,
  type AvatarStageObstacle,
} from "../lib/avatar/runtime";

const bottomInset = 24;

function viewportSize() {
  return {
    width: typeof window === "undefined" ? 1_200 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  };
}

function viewportSizeAsStage(): AvatarStageGeometry {
  const viewport = viewportSize();
  const floorY = viewport.height - bottomInset;
  return {
    dock: { x: Math.max(72, viewport.width - 80), y: floorY },
    obstacles: [],
    viewport: { width: viewport.width, height: viewport.height, floorY },
  };
}

function obstacleFor(element: HTMLElement | null): AvatarStageObstacle | null {
  if (!element) return null;
  const bounds = element.getBoundingClientRect();
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom,
    inViewport:
      bounds.width > 0 &&
      bounds.height > 0 &&
      bounds.bottom > 0 &&
      bounds.right > 0 &&
      bounds.left < viewportSize().width &&
      bounds.top < viewportSize().height,
  };
}

export function useAvatarStage({
  assistantOpen,
  reducedMotion,
}: {
  assistantOpen: boolean;
  reducedMotion: boolean;
}) {
  const stageRef = useRef<HTMLElement | null>(null);
  const chatRef = useRef<HTMLElement | null>(null);
  const dockObserver = useRef<ResizeObserver | null>(null);

  const readStage = useCallback((): AvatarStageGeometry => {
    const viewport = viewportSize();
    const stageBounds = stageRef.current?.getBoundingClientRect();
    const chatBounds = chatRef.current?.getBoundingClientRect();
    const width =
      stageBounds && stageBounds.width > 0
        ? Math.max(1, Math.min(viewport.width, Math.max(stageBounds.right, chatBounds?.right ?? 0)))
        : viewport.width;
    const floorY = viewport.height - bottomInset;
    const docked = Boolean(chatBounds && chatBounds.width > 0 && chatBounds.height > 0);
    const dock = docked && chatBounds
      ? {
          x: chatBounds.left + chatBounds.width / 2,
          y: chatBounds.bottom,
        }
      : { x: Math.max(72, width - 80), y: floorY };
    // The figure stands on the area's bottom edge and must fit inside it, so
    // a short Guide pane scales the actor down instead of lifting its head
    // above the bar.
    const dockHeight = docked && chatBounds ? chatBounds.height : null;
    const reader =
      typeof document === "undefined"
        ? null
        : document.querySelector<HTMLElement>(".portfolio-reader");
    const obstacles = [obstacleFor(chatRef.current), obstacleFor(reader)].filter(
      (value): value is AvatarStageObstacle => value !== null,
    );
    return {
      dock,
      dockHeight,
      obstacles,
      swimObstacles: [obstacleFor(reader)].filter(
        (value): value is AvatarStageObstacle => value !== null,
      ),
      viewport: { width, height: viewport.height, floorY },
    };
  }, []);

  const [avatarRuntime] = useState(
    () => new AvatarRuntime(viewportSizeAsStage),
  );
  const [avatarMounted, setAvatarMounted] = useState(false);

  // Callback refs have registered the dock before layout effects run. Install
  // that geometry before showing the figure below, so its first visible frame
  // never uses the constructor's bottom-right viewport fallback.
  useLayoutEffect(() => {
    avatarRuntime.setStageReader(readStage);
    avatarRuntime.refreshDock();
  }, [avatarRuntime, readStage]);

  const registerAvatarStage = useCallback((element: HTMLElement | null) => {
    stageRef.current = element;
    avatarRuntime.refreshDock();
  }, [avatarRuntime]);

  const registerAvatarDock = useCallback((element: HTMLElement | null) => {
    chatRef.current = element;
    dockObserver.current?.disconnect();
    dockObserver.current = null;
    // The avatar area stops resizing at its minimum height while a sash keeps
    // moving the whole Guide, so watch the Guide root too: any pane resize
    // re-docks the figure mid-drag instead of on release.
    if (element && typeof ResizeObserver !== "undefined" && typeof element.closest === "function") {
      const observer = new ResizeObserver(() => avatarRuntime.refreshDock());
      observer.observe(element);
      const guide = element.closest<HTMLElement>(".portfolio-chat");
      if (guide && guide !== element) observer.observe(guide);
      dockObserver.current = observer;
    }
    avatarRuntime.refreshDock();
  }, [avatarRuntime]);

  const refreshAvatarDock = useCallback(() => {
    avatarRuntime.refreshDock();
  }, [avatarRuntime]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAvatarMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    avatarRuntime.setReducedMotion(reducedMotion);
  }, [avatarRuntime, reducedMotion]);

  // Settle visibility before ResizeObserver delivers Guide/canvas dimensions.
  // A passive hide can otherwise flush inside a resize store update.
  useLayoutEffect(() => {
    if (assistantOpen) avatarRuntime.show();
    else avatarRuntime.hide();
  }, [assistantOpen, avatarRuntime]);

  useEffect(() => {
    const refresh = () => avatarRuntime.refreshDock();
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      dockObserver.current?.disconnect();
      dockObserver.current = null;
      avatarRuntime.cancel();
    };
  }, [avatarRuntime]);

  return {
    avatarMounted,
    avatarRuntime,
    refreshAvatarDock,
    registerAvatarDock,
    registerAvatarStage,
  };
}
