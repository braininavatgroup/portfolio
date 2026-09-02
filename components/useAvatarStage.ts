"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarTargetId } from "../lib/avatar/contracts";
import { createAvatarStageServices } from "../lib/avatar/stage-services";
import type { AvatarObstacleId } from "../lib/avatar/target-registry";

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
 * Which What record the assistant currently considers open, plus a turn counter
 * for discarding effects that arrive after the user has moved on. Held outside
 * React state on purpose: every reader is an event handler or an effect, and
 * re-rendering on a change here would be pure cost.
 */
class PortfolioAvatarActionState {
  #selectedWhatId: string | null = null;
  #turn = 0;

  beginTurn() {
    this.#turn += 1;
  }

  getTurn() {
    return this.#turn;
  }

  clearSelection() {
    this.#selectedWhatId = null;
  }

  selectWhat(whatId: string) {
    this.#selectedWhatId = whatId;
  }

  getSelectedWhatId() {
    return this.#selectedWhatId;
  }

}

/**
 * Everything the avatar needs to stand somewhere sensible: the stage services,
 * the element registrations the children hand up through callback refs, and
 * the eight effects that keep the stage in step with the viewport, the tab's
 * visibility and the user's motion preference.
 *
 * This was interleaved through PortfolioExperience with the map and reader
 * state, which made both harder to read than either is. The render seam stays
 * at two booleans; current What selection and turn ownership live in the
 * imperative action state returned to the experience.
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
    if (reducedMotion) avatarDirector.stop();
    avatarDirector.setReducedMotion(reducedMotion);
  }, [avatarDirector, reducedMotion]);

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

  // Callback refs own registration; this effect owns their shared teardown.
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
    refreshAssistantHome,
    registerAvatarStage,
    registerAvatarTarget,
    registerDirectorConsoleObstacle,
  };
}
