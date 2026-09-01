"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarTargetId } from "../lib/avatar/contracts";
import { createAvatarStageServices } from "../lib/avatar/stage-services";
import type { AvatarObstacleId } from "../lib/avatar/target-registry";
import type { SpatialGraphNode } from "../lib/spatial-graph";

const desktopAssistantHomeDock = {
  side: "left",
  target: "portfolio:chat",
} as const;

function getAssistantHomeDock() {
  return typeof window !== "undefined" && window.innerWidth <= 600
    ? ({ placement: "top", target: "portfolio:chat" } as const)
    : desktopAssistantHomeDock;
}

/**
 * Which project the assistant currently considers open, plus a turn counter
 * for discarding effects that arrive after the user has moved on. Held outside
 * React state on purpose: every reader is an event handler or an effect, and
 * re-rendering on a change here would be pure cost.
 */
export class PortfolioAvatarActionState {
  #selectedNode: SpatialGraphNode | null = null;
  #reducedMotion = false;
  #turn = 0;

  beginTurn() {
    this.#turn += 1;
  }

  getTurn() {
    return this.#turn;
  }

  clearSelection() {
    this.#selectedNode = null;
  }

  selectNode(node: SpatialGraphNode) {
    this.#selectedNode = node;
  }

  getSelectedNode() {
    return this.#selectedNode;
  }

  setReducedMotion(reducedMotion: boolean) {
    this.#reducedMotion = reducedMotion;
  }

  getReducedMotion() {
    return this.#reducedMotion;
  }
}

/**
 * Everything the avatar needs to stand somewhere sensible: the stage services,
 * the element registrations the children hand up through callback refs, and
 * the eight effects that keep the stage in step with the viewport, the tab's
 * visibility and the user's motion preference.
 *
 * This was interleaved through PortfolioExperience with the map and reader
 * state, which made both harder to read than either is. The seam is narrow —
 * two booleans in, services and callback refs out — because the avatar never
 * needed to know what is selected; only whether the assistant is on screen.
 */
export function useAvatarStage({
  assistantOpen,
  reducedMotion,
}: {
  assistantOpen: boolean;
  reducedMotion: boolean;
}) {
  const [services] = useState(createAvatarStageServices);
  const {
    controller: avatarController,
    director: avatarDirector,
    registry: avatarRegistry,
    runner: avatarRunner,
  } = services;
  const [avatarActionState] = useState(() => new PortfolioAvatarActionState());
  const [avatarMounted, setAvatarMounted] = useState(false);
  const [registeredAvatarTargets] = useState(
    () => new Map<AvatarTargetId, HTMLElement>(),
  );
  const [registeredAvatarObstacles] = useState(
    () => new Map<AvatarObstacleId, HTMLElement>(),
  );
  const registeredAvatarStage = useRef<HTMLElement | null>(null);

  // The window-level listeners below are registered once and must not re-run
  // when these change, so they read the current value through a ref.
  const assistantOpenRef = useRef(assistantOpen);
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => {
    assistantOpenRef.current = assistantOpen;
    reducedMotionRef.current = reducedMotion;
  }, [assistantOpen, reducedMotion]);

  const registerAvatarTarget = useCallback(
    (target: AvatarTargetId, element: HTMLElement | null) => {
      const previous = registeredAvatarTargets.get(target);
      if (previous && previous !== element) {
        avatarRegistry.unregister(target, previous);
        registeredAvatarTargets.delete(target);
      }
      if (element) {
        avatarRegistry.register(target, element);
        registeredAvatarTargets.set(target, element);
      }
    },
    [avatarRegistry, registeredAvatarTargets],
  );

  const registerAvatarObstacle = useCallback(
    (obstacle: AvatarObstacleId, element: HTMLElement | null) => {
      const previous = registeredAvatarObstacles.get(obstacle);
      if (previous && previous !== element) {
        avatarRegistry.unregisterObstacle(obstacle, previous);
        registeredAvatarObstacles.delete(obstacle);
      }
      if (element) {
        avatarRegistry.registerObstacle(obstacle, element);
        registeredAvatarObstacles.set(obstacle, element);
      }
    },
    [avatarRegistry, registeredAvatarObstacles],
  );

  const registerHeaderObstacle = useCallback(
    (element: HTMLElement | null) =>
      registerAvatarObstacle("portfolio:header", element),
    [registerAvatarObstacle],
  );

  const registerDirectorConsoleObstacle = useCallback(
    (element: HTMLDivElement | null) =>
      registerAvatarObstacle("avatar:director-console", element),
    [registerAvatarObstacle],
  );

  const registerAvatarStage = useCallback(
    (element: HTMLElement | null) => {
      const previous = registeredAvatarStage.current;
      if (previous && previous !== element) avatarRegistry.unregisterStage(previous);
      registeredAvatarStage.current = element;
      if (element) {
        avatarRegistry.registerStage(element);
        avatarController.refreshStage(true);
      }
    },
    [avatarController, avatarRegistry],
  );

  const registerHero = useCallback(
    (element: HTMLHeadingElement | null) => registerAvatarTarget("hero", element),
    [registerAvatarTarget],
  );

  const refreshAssistantHome = useCallback(() => {
    if (!assistantOpenRef.current) return;
    avatarController.refreshStage(true, getAssistantHomeDock());
  }, [avatarController]);

  // Deferred a tick so the first paint is the page, not the avatar.
  useEffect(() => {
    const timer = window.setTimeout(() => setAvatarMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    avatarActionState.setReducedMotion(reducedMotion);
    if (reducedMotion) avatarDirector.stop();
    avatarDirector.setReducedMotion(reducedMotion);
  }, [avatarActionState, avatarDirector, reducedMotion]);

  useEffect(() => () => avatarDirector.dispose(), [avatarDirector]);

  useEffect(() => {
    if (assistantOpen && !document.hidden && !reducedMotion) {
      avatarDirector.startAmbient();
      return;
    }
    avatarDirector.stop();
  }, [assistantOpen, avatarDirector, reducedMotion]);

  useEffect(() => {
    if (!assistantOpen) return;
    const timer = window.setTimeout(() => {
      avatarController.refreshStage(true, getAssistantHomeDock());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [assistantOpen, avatarController]);

  useEffect(() => {
    const refreshTarget = () => {
      const command = avatarController.getSnapshot().currentCommand;
      if (
        command?.action === "walkTo" ||
        command?.action === "lookAt" ||
        command?.action === "pointAt"
      ) {
        avatarController.refreshStage(true, getAssistantHomeDock());
        void avatarController.execute(command);
      } else {
        avatarController.refreshStage(true, getAssistantHomeDock());
      }
    };
    const handleVisibility = () => {
      if (
        assistantOpenRef.current &&
        !document.hidden &&
        !reducedMotionRef.current
      ) {
        refreshTarget();
        avatarDirector.startAmbient();
      } else {
        avatarDirector.stop();
      }
    };
    const refreshVisibleTarget = () => {
      if (assistantOpenRef.current) refreshTarget();
    };
    window.addEventListener("scroll", refreshVisibleTarget, { passive: true });
    window.addEventListener("resize", refreshVisibleTarget);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("scroll", refreshVisibleTarget);
      window.removeEventListener("resize", refreshVisibleTarget);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [avatarController, avatarDirector]);

  /**
   * Registry teardown, owned separately. It used to ride on the listener
   * effect's cleanup, which tore down registrations that effect never created
   * — they come from the callback refs above, driven by child components. That
   * was harmless only because every dep there was a lazily-constructed
   * singleton, so the effect never re-ran. Adding one reactive dep would have
   * wiped the whole registry mid-session, with the children's refs already
   * fired and nothing left to re-register them.
   */
  useEffect(
    () => () => {
      avatarActionState.beginTurn();
      for (const [target, element] of registeredAvatarTargets) {
        avatarRegistry.unregister(target, element);
      }
      registeredAvatarTargets.clear();
      for (const [obstacle, element] of registeredAvatarObstacles) {
        avatarRegistry.unregisterObstacle(obstacle, element);
      }
      registeredAvatarObstacles.clear();
      if (registeredAvatarStage.current) {
        avatarRegistry.unregisterStage(registeredAvatarStage.current);
        registeredAvatarStage.current = null;
      }
    },
    [
      avatarActionState,
      avatarRegistry,
      registeredAvatarObstacles,
      registeredAvatarTargets,
    ],
  );

  return {
    avatarActionState,
    avatarController,
    avatarDirector,
    avatarMounted,
    avatarRegistry,
    avatarRunner,
    refreshAssistantHome,
    registerAvatarObstacle,
    registerAvatarStage,
    registerAvatarTarget,
    registerDirectorConsoleObstacle,
    registerHeaderObstacle,
    registerHero,
  };
}
