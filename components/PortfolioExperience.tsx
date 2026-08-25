"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { AvatarController } from "../lib/avatar/controller";
import type {
  AvatarTargetId,
  PortfolioResponseEffects,
} from "../lib/avatar/contracts";
import {
  readAvatarEnabled,
  writeAvatarEnabled,
} from "../lib/avatar/preference";
import { AvatarSequenceRunner } from "../lib/avatar/sequence-runner";
import { SiteActionExecutor } from "../lib/avatar/site-actions";
import { adaptCommandsForReducedMotion } from "../lib/avatar/state";
import { AvatarTargetRegistry } from "../lib/avatar/target-registry";
import { visibleGraphNodes } from "../lib/graph-emphasis";
import { domains, type DomainId } from "../lib/portfolio";
import { getPortfolioChatTurnstileSiteKey } from "../lib/portfolio-chat-config";
import { getPortfolioDossier } from "../lib/portfolio-dossier";
import {
  portfolioNodes,
  type SpatialGraphNode,
} from "../lib/spatial-graph";
import {
  transitionDuration,
  transitionReducer,
  type TransitionPhase,
} from "../lib/transition";
import { KeyboardNavigator } from "./KeyboardNavigator";
import { PortfolioChat } from "./PortfolioChat";
import { PortfolioDossier } from "./PortfolioDossier";
import { PortfolioHeader } from "./PortfolioHeader";
import { TransitionStatus } from "./TransitionStatus";
import type { PoseState } from "./scene/BodyScene";

const PortfolioCanvas = lazy(() =>
  import("./scene/PortfolioCanvas").then((module) => ({
    default: module.PortfolioCanvas,
  })),
);

const AvatarOverlay = lazy(() =>
  import("./avatar/AvatarOverlay").then((module) => ({
    default: module.AvatarOverlay,
  })),
);

class PortfolioAvatarActionState {
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

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function PortfolioExperience({
  initialPhase = "body",
}: {
  initialPhase?: Extract<TransitionPhase, "body" | "graph">;
}) {
  const [transition, dispatch] = useReducer(transitionReducer, {
    phase: initialPhase,
    run: 0,
  });
  const reducedMotion = useReducedMotion();
  const [selectedDomain, setSelectedDomain] = useState<DomainId | null>(null);
  const [pose, setPose] = useState<PoseState>("idle");
  const [keyboardNodeId, setKeyboardNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<SpatialGraphNode | null>(null);
  const [spotlightTarget, setSpotlightTarget] =
    useState<AvatarTargetId | null>(null);
  const [avatarEnabled, setAvatarEnabled] = useState(true);
  const [avatarMounted, setAvatarMounted] = useState(false);
  const [avatarDebug, setAvatarDebug] = useState(false);
  const [avatarRegistry] = useState(() => new AvatarTargetRegistry());
  const [avatarController] = useState(
    () => new AvatarController(avatarRegistry),
  );
  const [avatarRunner] = useState(
    () =>
      new AvatarSequenceRunner((command) => avatarController.execute(command)),
  );
  const [avatarActionState] = useState(
    () => new PortfolioAvatarActionState(),
  );
  const [registeredAvatarTargets] = useState(
    () => new Map<AvatarTargetId, HTMLElement>(),
  );

  const dossier = selectedNode
    ? getPortfolioDossier(selectedNode)
    : undefined;
  const visibleNodes = visibleGraphNodes(portfolioNodes, {
    selectedDomain,
    selectedProjectId: selectedNode?.projectId ?? null,
  });

  const showIndex = useCallback(() => {
    avatarActionState.clearSelection();
    setSelectedDomain(null);
    setSelectedNode(null);
    setKeyboardNodeId(null);
  }, [avatarActionState]);

  const selectDomain = useCallback((domain: DomainId | null) => {
    avatarActionState.clearSelection();
    setSelectedDomain(domain);
    setSelectedNode(null);
    setKeyboardNodeId(null);
  }, [avatarActionState]);

  const selectNode = useCallback(
    (node: SpatialGraphNode | null) => {
      if (!node || node.role === "root") {
        showIndex();
        return;
      }

      if (node.role === "domain") {
        const domain = domains.find(({ id }) => id === node.groupId)?.id ?? null;
        selectDomain(domain);
        return;
      }

      const nextDossier = getPortfolioDossier(node);
      if (!nextDossier) {
        showIndex();
        return;
      }

      const domain = domains.find(({ id }) => id === node.groupId)?.id ?? null;
      avatarActionState.selectNode(node);
      setSelectedDomain(domain);
      setSelectedNode(node);
    },
    [avatarActionState, selectDomain, showIndex],
  );

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
  const registerHero = useCallback(
    (element: HTMLHeadingElement | null) =>
      registerAvatarTarget("hero", element),
    [registerAvatarTarget],
  );

  const [siteActionExecutor] = useState(
    () =>
      new SiteActionExecutor(avatarRegistry, {
        openProject: (target) => {
          const slug = target.slice("project:".length);
          const node =
            portfolioNodes.find(
              ({ projectSlug, role }) =>
                projectSlug === slug && role === "instinct",
            ) ?? portfolioNodes.find(({ projectSlug }) => projectSlug === slug);
          if (!node) throw new Error("Unknown project target");
          selectNode(node);
        },
        closeProject: showIndex,
        activateTab: (tab) => {
          const projectSlug = avatarActionState.getSelectedNode()?.projectSlug;
          const node = portfolioNodes.find(
            ({ projectSlug: candidate, role }) =>
              candidate === projectSlug && role === tab,
          );
          if (!node) throw new Error("No selected project tab");
          selectNode(node);
        },
        scrollTo: (_target, bounds) => {
          window.scrollTo({
            behavior: avatarActionState.getReducedMotion() ? "auto" : "smooth",
            top: window.scrollY + bounds.top,
          });
        },
        spotlight: setSpotlightTarget,
        clearSpotlight: () => setSpotlightTarget(null),
      }),
  );

  const avatarIntegration = useMemo(
    () => ({
      onTurnStart: () => {
        avatarActionState.beginTurn();
        avatarRunner.cancel();
        avatarController.execute({ action: "setState", state: "thinking" });
      },
      onEvidence: () =>
        avatarController.execute({ action: "setState", state: "tool_use" }),
      onFirstText: () =>
        avatarController.execute({ action: "setState", state: "talking" }),
      onEffects: async (effects: PortfolioResponseEffects) => {
        const turn = avatarActionState.getTurn();
        const isCurrentTurn = () => avatarActionState.getTurn() === turn;
        let dossierRenderPending = false;
        for (const action of effects.siteActions) {
          if (!isCurrentTurn()) return;
          if (dossierRenderPending && action.type === "scrollTo") {
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
            if (!isCurrentTurn()) return;
            dossierRenderPending = false;
          }
          const result = await siteActionExecutor.execute(action);
          if (
            result.ok &&
            (action.type === "openProject" ||
              action.type === "closeProject" ||
              action.type === "activateTab")
          ) {
            dossierRenderPending = true;
          }
        }
        if (effects.siteActions.length > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
        }
        if (!isCurrentTurn()) return;
        const commands = avatarActionState.getReducedMotion()
          ? adaptCommandsForReducedMotion(effects.avatarSequence)
          : effects.avatarSequence;
        await avatarRunner.run(commands);
      },
      onNotice: () =>
        avatarController.execute({ action: "setState", state: "confused" }),
      onError: () =>
        avatarController.execute({ action: "setState", state: "error" }),
      onComplete: () =>
        avatarController.execute({ action: "setState", state: "idle" }),
    }),
    [avatarActionState, avatarController, avatarRunner, siteActionExecutor],
  );

  useEffect(() => {
    dispatch({ type: initialPhase === "graph" ? "SHOW_GRAPH" : "RESET" });
  }, [initialPhase]);

  useEffect(() => {
    if (transition.phase !== "entering" && transition.phase !== "returning") {
      return;
    }
    const timer = window.setTimeout(
      () => dispatch({ type: "COMPLETE" }),
      transitionDuration(reducedMotion),
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, transition.phase, transition.run]);

  useEffect(() => {
    const syncWithLocation = () => {
      const graphRequested =
        new URLSearchParams(window.location.search).get("view") === "graph";
      showIndex();
      setPose("idle");
      dispatch({ type: graphRequested ? "ENTER" : "EXIT" });
    };
    window.addEventListener("popstate", syncWithLocation);
    return () => window.removeEventListener("popstate", syncWithLocation);
  }, [showIndex]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAvatarEnabled(readAvatarEnabled());
      setAvatarDebug(
        process.env.NODE_ENV === "development" &&
          new URLSearchParams(window.location.search).get("avatarDebug") === "1",
      );
      setAvatarMounted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    avatarActionState.setReducedMotion(reducedMotion);
  }, [avatarActionState, reducedMotion]);

  useEffect(() => {
    const refreshTarget = () => {
      const command = avatarController.getSnapshot().currentCommand;
      if (
        command?.action === "walkTo" ||
        command?.action === "lookAt" ||
        command?.action === "pointAt"
      ) {
        avatarController.execute(command);
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        avatarRunner.cancel();
      } else {
        refreshTarget();
      }
    };
    window.addEventListener("scroll", refreshTarget, { passive: true });
    window.addEventListener("resize", refreshTarget);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("scroll", refreshTarget);
      window.removeEventListener("resize", refreshTarget);
      document.removeEventListener("visibilitychange", handleVisibility);
      avatarActionState.beginTurn();
      avatarRunner.cancel();
      for (const [target, element] of registeredAvatarTargets) {
        avatarRegistry.unregister(target, element);
      }
      registeredAvatarTargets.clear();
    };
  }, [
    avatarController,
    avatarActionState,
    avatarRegistry,
    avatarRunner,
    registeredAvatarTargets,
  ]);

  const setAvatarPreference = useCallback((enabled: boolean) => {
    setAvatarEnabled(enabled);
    writeAvatarEnabled(enabled);
  }, []);

  function enterMap() {
    if (transition.phase !== "body") return;
    window.history.pushState({}, "", "/?view=graph");
    dispatch({ type: "ENTER" });
  }

  function exitMap() {
    if (transition.phase !== "graph" && transition.phase !== "entering") {
      return;
    }
    window.history.pushState({}, "", "/");
    showIndex();
    dispatch({ type: "EXIT" });
  }

  return (
    <main
      className={`experience experience-${transition.phase}`}
      data-theme="light"
      id="main-content"
    >
      <TransitionStatus phase={transition.phase} />
      <PortfolioHeader
        activeView={
          transition.phase === "body" || transition.phase === "returning"
            ? "bradley"
            : "map"
        }
        onBradleySelect={exitMap}
        onMapSelect={enterMap}
        overlay
      />
      <section
        aria-label={
          transition.phase === "body"
            ? "Bradley Berkman landing"
            : "Spatial portfolio map"
        }
        className={`scene-shell${selectedNode ? " scene-shell-node-open" : ""}${selectedDomain ? " scene-shell-domain-focus" : ""}`}
        id="brain"
      >
        <Suspense
          fallback={
            <div className="scene-loading" role="status">
              Preparing the spatial view. All project pages are available now.
            </div>
          }
        >
          <PortfolioCanvas
            nodes={visibleNodes}
            phase={transition.phase}
            pose={pose}
            selectedDomain={selectedDomain}
            reducedMotion={reducedMotion}
            focusedNodeId={keyboardNodeId}
            selectedNodeId={selectedNode?.id ?? null}
            onEnter={enterMap}
            onNodeSelect={selectNode}
          />
        </Suspense>

        <div className="scene-copy">
          <h1
            className={
              spotlightTarget === "hero" ? "avatar-spotlight" : undefined
            }
            ref={registerHero}
          >
            I find where judgment matters, then build the system around it.
          </h1>
        </div>

        {transition.phase === "graph" ? (
          <>
            <PortfolioDossier
              dossier={dossier}
              onDomainSelect={selectDomain}
              onShowIndex={showIndex}
              registerAvatarTarget={registerAvatarTarget}
              selectedDomain={selectedDomain}
              spotlightTarget={spotlightTarget}
            />

            <KeyboardNavigator
              nodes={visibleNodes}
              onNodeFocus={setKeyboardNodeId}
              onNodeSelect={selectNode}
              selectedNodeId={selectedNode?.id ?? null}
            />
          </>
        ) : null}
        <PortfolioChat
          avatarIntegration={avatarIntegration}
          onPoseChange={setPose}
          registerAvatarTarget={registerAvatarTarget}
          spotlightTarget={spotlightTarget}
          turnstileSiteKey={getPortfolioChatTurnstileSiteKey()}
        />
        {avatarMounted ? (
          <Suspense fallback={null}>
            <AvatarOverlay
              controller={avatarController}
              debug={avatarDebug}
              development={process.env.NODE_ENV === "development"}
              enabled={avatarEnabled}
              onEnabledChange={setAvatarPreference}
              runner={avatarRunner}
              siteActionExecutor={siteActionExecutor}
            />
          </Suspense>
        ) : null}
      </section>
    </main>
  );
}
