"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { AvatarController } from "../lib/avatar/controller";
import { AvatarDirector } from "../lib/avatar/director";
import type {
  AvatarTargetId,
  PortfolioResponseEffects,
  ProjectAvatarTargetId,
} from "../lib/avatar/contracts";
import {
  readAvatarEnabled,
  writeAvatarEnabled,
} from "../lib/avatar/preference";
import { AvatarSequenceRunner } from "../lib/avatar/sequence-runner";
import { SiteActionExecutor } from "../lib/avatar/site-actions";
import { AvatarTargetRegistry } from "../lib/avatar/target-registry";
import type { AvatarObstacleId } from "../lib/avatar/target-registry";
import { visibleGraphNodes } from "../lib/graph-emphasis";
import { isExactShiftShortcut } from "../lib/dom-keyboard";
import { domains, type DomainId } from "../lib/portfolio";
import { getPortfolioChatTurnstileSiteKey } from "../lib/portfolio-chat-config";
import {
  portfolioThreadById,
  portfolioWorldNodes,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";
import {
  portfolioNodes,
  type SpatialGraphNode,
} from "../lib/spatial-graph";
import {
  transitionDuration,
  transitionReducer,
  type TransitionPhase,
} from "../lib/transition";
import { PortfolioChat } from "./PortfolioChat";
import { PortfolioHeader } from "./PortfolioHeader";
import { PortfolioReader } from "./PortfolioReader";
import { PortfolioWorld } from "./PortfolioWorld";
import { TransitionStatus } from "./TransitionStatus";
import { AvatarToyboxBoundary } from "./avatar-toybox/AvatarToyboxBoundary";
import { useAvatarToyboxSession } from "./avatar-toybox/useAvatarToyboxSession";
import { getOutputToken } from "./scene/output-token-map";
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

const AvatarToyboxOverlay = lazy(() =>
  import("./avatar-toybox/AvatarToyboxOverlay").then((module) => ({
    default: module.AvatarToyboxOverlay,
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

function readWorldLocation() {
  const parts = window.location.hash.slice(1).split("/").filter(Boolean);
  // "thread/…" is canonical; "story/…" remains parseable for old links.
  if (parts[0] === "thread" || parts[0] === "story") {
    return { threadId: parts[1] ?? null, nodeId: parts[2] ?? null };
  }
  return { threadId: null, nodeId: parts[0] ?? null };
}

function pushWorldLocation(nodeId: string | null, threadId: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "graph");
  url.hash = threadId
    ? `thread/${threadId}${nodeId ? `/${nodeId}` : ""}`
    : nodeId ?? "";
  window.history.pushState({ nodeId, threadId }, "", url);
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
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [spotlightTarget, setSpotlightTarget] =
    useState<AvatarTargetId | null>(null);
  const [avatarEnabled, setAvatarEnabled] = useState(true);
  const [avatarMounted, setAvatarMounted] = useState(false);
  const [avatarDebug, setAvatarDebug] = useState(
    () =>
      typeof window !== "undefined" &&
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("avatarDebug") === "1",
  );
  const [avatarRegistry] = useState(() => new AvatarTargetRegistry());
  const [avatarController] = useState(
    () => new AvatarController(avatarRegistry),
  );
  const [avatarRunner] = useState(
    () =>
      new AvatarSequenceRunner((command, signal) =>
        avatarController.execute(command, signal),
      ),
  );
  const [avatarDirector] = useState(
    () => new AvatarDirector(avatarController, avatarRunner, avatarRegistry),
  );
  const [avatarActionState] = useState(
    () => new PortfolioAvatarActionState(),
  );
  const [registeredAvatarTargets] = useState(
    () => new Map<AvatarTargetId, HTMLElement>(),
  );
  const [registeredAvatarObstacles] = useState(
    () => new Map<AvatarObstacleId, HTMLElement>(),
  );
  const registeredAvatarStage = useRef<HTMLElement | null>(null);

  const visibleNodes = visibleGraphNodes(portfolioNodes, {
    selectedDomain,
    selectedProjectId: selectedNode?.projectId ?? null,
  });
  const toyboxCollectibles = useMemo(
    () =>
      portfolioNodes
        .filter(({ role }) => role === "output")
        .map(({ id, label, projectSlug }) => ({
          id,
          label,
          tokenKind: projectSlug ? getOutputToken(projectSlug) : undefined,
        })),
    [],
  );
  const canOpenToybox = useCallback(() => {
    const snapshot = avatarController.getSnapshot();
    return (
      transition.phase === "graph" &&
      avatarMounted &&
      !snapshot.failed
    );
  }, [avatarController, avatarMounted, transition.phase]);
  const closeAvatarDirector = useCallback(() => setAvatarDebug(false), []);
  const toyboxSession = useAvatarToyboxSession({
    canOpen: canOpenToybox,
    collectibles: toyboxCollectibles,
    onOpen: closeAvatarDirector,
    reducedMotion,
  });

  useEffect(() => {
    if (!import.meta.env.DEV || transition.phase !== "graph") return;
    const handleDirectorShortcut = (event: KeyboardEvent) => {
      if (!isExactShiftShortcut(event, "a") || toyboxSession.isOpen) return;
      event.preventDefault();
      setAvatarDebug((value) => !value);
    };
    document.addEventListener("keydown", handleDirectorShortcut);
    return () => document.removeEventListener("keydown", handleDirectorShortcut);
  }, [toyboxSession.isOpen, transition.phase]);

  const showIndex = useCallback(() => {
    avatarActionState.clearSelection();
    setSelectedDomain(null);
    setSelectedNode(null);
    setSelectedWorldId(null);
    setActiveThreadId(null);
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

      if (!node.projectSlug) {
        showIndex();
        return;
      }

      const domain = domains.find(({ id }) => id === node.groupId)?.id ?? null;
      avatarActionState.selectNode(node);
      setSelectedDomain(domain);
      setSelectedNode(node);
      const worldNode = portfolioWorldNodes.find(
        ({ projectSlug }) => projectSlug === node.projectSlug,
      );
      setSelectedWorldId(worldNode?.id ?? null);
      setActiveThreadId(null);
    },
    [avatarActionState, selectDomain, showIndex],
  );

  const selectNodeWithAvatar = useCallback(
    (node: SpatialGraphNode | null) => {
      const previous = avatarActionState.getSelectedNode();
      selectNode(node);
      if (!node || node.role === "root" || node.role === "domain") {
        if (previous) {
          window.setTimeout(
            () => void avatarDirector.handle({ type: "project_close" }),
            0,
          );
        }
        return;
      }
      if (!node.projectSlug) return;
      const target: ProjectAvatarTargetId = `project:${node.projectSlug}`;
      window.setTimeout(
        () =>
          void avatarDirector.handle({
            type:
              previous?.projectSlug === node.projectSlug
                ? "tab_change"
                : "project_open",
            target,
          }),
        0,
      );
    },
    [avatarActionState, avatarDirector, selectNode],
  );

  const selectWorldNode = useCallback(
    (node: PortfolioWorldNode) => {
      if (selectedWorldId === node.id) {
        const previous = avatarActionState.getSelectedNode();
        avatarActionState.clearSelection();
        setSelectedNode(null);
        setSelectedDomain(null);
        setKeyboardNodeId(null);

        if (activeThreadId && node.family !== "story") {
          const story = portfolioThreadById.get(activeThreadId);
          setSelectedWorldId(story?.nodeId ?? null);
          pushWorldLocation(null, activeThreadId);
        } else {
          showIndex();
          pushWorldLocation(null, null);
        }
        if (previous) {
          window.setTimeout(
            () => void avatarDirector.handle({ type: "project_close" }),
            0,
          );
        }
        return;
      }

      setSelectedWorldId(node.id);
      setKeyboardNodeId(null);

      if (node.family === "story") {
        setActiveThreadId(node.threadId ?? null);
        const previous = avatarActionState.getSelectedNode();
        avatarActionState.clearSelection();
        setSelectedNode(null);
        setSelectedDomain(null);
        pushWorldLocation(null, node.threadId ?? null);
        if (previous) {
          window.setTimeout(
            () => void avatarDirector.handle({ type: "project_close" }),
            0,
          );
        }
        return;
      }

      const retainedStoryId = activeThreadId &&
        portfolioThreadById.get(activeThreadId)?.members.includes(node.id)
        ? activeThreadId
        : null;

      if (!node.projectSlug) {
        setActiveThreadId(retainedStoryId);
        const previous = avatarActionState.getSelectedNode();
        avatarActionState.clearSelection();
        setSelectedNode(null);
        setSelectedDomain(null);
        pushWorldLocation(node.id, retainedStoryId);
        if (previous) {
          window.setTimeout(
            () => void avatarDirector.handle({ type: "project_close" }),
            0,
          );
        }
        return;
      }

      const spatialNode =
        portfolioNodes.find(
          ({ projectSlug, role }) =>
            projectSlug === node.projectSlug && role === "output",
        ) ?? portfolioNodes.find(({ projectSlug }) => projectSlug === node.projectSlug);
      if (spatialNode) selectNodeWithAvatar(spatialNode);
      setSelectedWorldId(node.id);
      setActiveThreadId(retainedStoryId);
      pushWorldLocation(node.id, retainedStoryId);
    },
    [
      activeThreadId,
      avatarActionState,
      avatarDirector,
      selectedWorldId,
      selectNodeWithAvatar,
      showIndex,
    ],
  );

  const selectThread = useCallback((threadId: string) => {
    const threadNode = portfolioWorldNodes.find(
      (node) => node.threadId === threadId,
    );
    if (threadNode) selectWorldNode(threadNode);
  }, [selectWorldNode]);

  const showIndexWithAvatar = useCallback(() => {
    const hadProject = Boolean(avatarActionState.getSelectedNode());
    const hadComposition = Boolean(selectedWorldId || activeThreadId);
    showIndex();
    if (hadComposition) pushWorldLocation(null, null);
    if (hadProject) {
      window.setTimeout(
        () => void avatarDirector.handle({ type: "project_close" }),
        0,
      );
    }
  }, [activeThreadId, avatarActionState, avatarDirector, selectedWorldId, showIndex]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && transition.phase === "graph") {
        showIndexWithAvatar();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showIndexWithAvatar, transition.phase]);

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
    [avatarController, avatarRegistry, registeredAvatarStage],
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
        return avatarDirector.handle({ type: "turn_start" });
      },
      onInputFocus: () => avatarDirector.handle({ type: "input_focus" }),
      onInputActivity: () => avatarDirector.handle({ type: "input_activity" }),
      onInputBlur: () => avatarDirector.handle({ type: "input_blur" }),
      onEvidence: () => avatarDirector.handle({ type: "evidence" }),
      onFirstText: () => avatarDirector.handle({ type: "first_text" }),
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
        await avatarDirector.perform(effects);
      },
      onNotice: () =>
        avatarController.execute({ action: "setState", state: "confused" }),
      onError: () =>
        avatarController.execute({ action: "setState", state: "error" }),
      onComplete: () => avatarDirector.handle({ type: "turn_complete" }),
    }),
    [avatarActionState, avatarController, avatarDirector, siteActionExecutor],
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
    let initialSync = true;
    const syncWithLocation = () => {
      const graphRequested =
        new URLSearchParams(window.location.search).get("view") === "graph" ||
        (initialSync && initialPhase === "graph");
      initialSync = false;
      showIndex();
      setPose("idle");
      dispatch({ type: graphRequested ? "ENTER" : "EXIT" });
      if (!graphRequested) return;

      const { nodeId, threadId } = readWorldLocation();
      const story = threadId ? portfolioThreadById.get(threadId) : undefined;
      const node = nodeId ? portfolioWorldNodes.find(({ id }) => id === nodeId) : undefined;
      if (story) {
        setActiveThreadId(story.id);
        setSelectedWorldId(node?.id ?? story.nodeId);
      } else if (node) {
        setSelectedWorldId(node.id);
      }
    };
    window.addEventListener("popstate", syncWithLocation);
    syncWithLocation();
    return () => window.removeEventListener("popstate", syncWithLocation);
  }, [initialPhase, showIndex]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAvatarEnabled(readAvatarEnabled());
      setAvatarMounted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    avatarActionState.setReducedMotion(reducedMotion);
    if (reducedMotion) avatarDirector.stop();
    avatarDirector.setReducedMotion(reducedMotion);
  }, [avatarActionState, avatarDirector, reducedMotion]);

  useEffect(() => {
    if (!document.hidden) avatarDirector.startAmbient();
    return () => avatarDirector.dispose();
  }, [avatarDirector]);

  useEffect(() => {
    const refreshTarget = () => {
      const command = avatarController.getSnapshot().currentCommand;
      if (
        command?.action === "walkTo" ||
        command?.action === "lookAt" ||
        command?.action === "pointAt"
      ) {
        avatarController.execute(command);
      } else {
        avatarController.refreshStage(true);
      }
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        refreshTarget();
        avatarDirector.startAmbient();
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
    };
  }, [
    avatarController,
    avatarActionState,
    avatarDirector,
    avatarRegistry,
    registeredAvatarObstacles,
    registeredAvatarStage,
    registeredAvatarTargets,
  ]);

  const setAvatarPreference = useCallback((enabled: boolean) => {
    if (!enabled) avatarDirector.stop();
    setAvatarEnabled(enabled);
    writeAvatarEnabled(enabled);
  }, [avatarDirector]);

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

  const avatarOverlay = avatarMounted && !toyboxSession.isPlaying ? (
    <Suspense fallback={null}>
      <AvatarOverlay
        controller={avatarController}
        debug={avatarDebug}
        development={import.meta.env.DEV}
        director={avatarDirector}
        enabled={avatarEnabled}
        onEnabledChange={setAvatarPreference}
        onExpandedPanelChange={registerDirectorConsoleObstacle}
        reducedMotion={reducedMotion}
        registry={avatarRegistry}
        runner={avatarRunner}
        siteActionExecutor={siteActionExecutor}
      />
    </Suspense>
  ) : null;
  const portfolioChat = (
    <PortfolioChat
      avatarIntegration={avatarIntegration}
      onPoseChange={setPose}
      registerAvatarTarget={registerAvatarTarget}
      spotlightTarget={spotlightTarget}
      turnstileSiteKey={getPortfolioChatTurnstileSiteKey()}
    />
  );

  return (
    <main
      className={`experience experience-${transition.phase}${transition.phase === "graph" ? " portfolio-composition" : ""}`}
      id="main-content"
      tabIndex={-1}
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
        obstacleRef={registerHeaderObstacle}
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
        {transition.phase === "graph" ? (
          <PortfolioWorld
            activeThreadId={activeThreadId}
            onReset={showIndexWithAvatar}
            onSelect={selectWorldNode}
            registerAvatarStage={registerAvatarStage}
            selectedId={selectedWorldId}
          />
        ) : (
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
              onNodeSelect={selectNodeWithAvatar}
            />
          </Suspense>
        )}

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
            <PortfolioReader
              activeThreadId={activeThreadId}
              onReset={showIndexWithAvatar}
              onSelect={selectWorldNode}
              onSelectThread={selectThread}
              registerAvatarTarget={registerAvatarTarget}
              selectedId={selectedWorldId}
              spotlightTarget={spotlightTarget}
            />
          </>
        ) : null}
        {portfolioChat}
      </section>
      {avatarOverlay}
      {toyboxSession.isOpen ? (
        <AvatarToyboxBoundary onFailure={() => toyboxSession.close("Avatar toybox closed after a renderer error.")}>
          <Suspense fallback={null}>
            <AvatarToyboxOverlay session={toyboxSession} />
          </Suspense>
        </AvatarToyboxBoundary>
      ) : null}
    </main>
  );
}
