"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PortfolioResponseEffects,
  ProjectAvatarTargetId,
} from "../lib/avatar/contracts";
import { isExactShiftShortcut } from "../lib/dom-keyboard";
import { domains, type DomainId } from "../lib/portfolio";
import { getPortfolioChatTurnstileSiteKey } from "../lib/portfolio-chat-config";
import {
  portfolioThreadById,
  portfolioThroughline,
  portfolioWorldNodes,
  type PortfolioVisualBlock,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";
import {
  portfolioNodes,
  type SpatialGraphNode,
} from "../lib/spatial-graph";
import { PortfolioChat } from "./PortfolioChat";
import { EditableText } from "./editor/EditableText";
import { PortfolioHeader } from "./PortfolioHeader";
import { PortfolioReader } from "./PortfolioReader";
import { PortfolioWorld } from "./PortfolioWorld";
import { AvatarToyboxBoundary } from "./avatar-toybox/AvatarToyboxBoundary";
import { useAvatarToyboxSession } from "./avatar-toybox/useAvatarToyboxSession";
import { getOutputToken } from "./scene/output-token-map";
import { useAvatarStage } from "./useAvatarStage";

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

export function PortfolioExperience() {
  const reducedMotion = useReducedMotion();
  const [selectedDomain, setSelectedDomain] = useState<DomainId | null>(null);
  const [selectedNode, setSelectedNode] = useState<SpatialGraphNode | null>(null);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeVisual, setActiveVisual] = useState<PortfolioVisualBlock | null>(null);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [avatarDebug, setAvatarDebug] = useState(
    () =>
      typeof window !== "undefined" &&
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("avatarDebug") === "1",
  );
  const {
    avatarActionState,
    avatarController,
    avatarDirector,
    avatarMounted,
    avatarRegistry,
    avatarRunner,
    refreshAssistantHome,
    registerAvatarStage,
    registerAvatarTarget,
    registerDirectorConsoleObstacle,
    registerHeaderObstacle,
    registerHero,
  } = useAvatarStage({ assistantOpen, reducedMotion });
  const visualTriggerRef = useRef<HTMLButtonElement | null>(null);

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
    return avatarMounted && !snapshot.failed;
  }, [avatarController, avatarMounted]);
  const closeAvatarDirector = useCallback(() => setAvatarDebug(false), []);
  const toyboxSession = useAvatarToyboxSession({
    canOpen: canOpenToybox,
    collectibles: toyboxCollectibles,
    onOpen: closeAvatarDirector,
    reducedMotion,
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handleDirectorShortcut = (event: KeyboardEvent) => {
      if (!isExactShiftShortcut(event, "a") || toyboxSession.isOpen) return;
      event.preventDefault();
      setAvatarDebug((value) => !value);
    };
    document.addEventListener("keydown", handleDirectorShortcut);
    return () => document.removeEventListener("keydown", handleDirectorShortcut);
  }, [toyboxSession.isOpen]);

  /**
   * The director reads the DOM this state change is about to alter, so the
   * notification has to land after React commits. This pairing — read the
   * outgoing selection, clear it, tell the director only if there was one —
   * appeared five times, and the "only if there was one" guard is the part
   * that is easy to drop.
   */
  const notifyProjectClosed = useCallback(
    (previous: SpatialGraphNode | null) => {
      if (!previous) return;
      window.setTimeout(
        () => void avatarDirector.handle({ type: "project_close" }),
        0,
      );
    },
    [avatarDirector],
  );

  const clearProjectSelection = useCallback(() => {
    const previous = avatarActionState.getSelectedNode();
    avatarActionState.clearSelection();
    setSelectedNode(null);
    setSelectedDomain(null);
    notifyProjectClosed(previous);
  }, [avatarActionState, notifyProjectClosed]);

  const showIndex = useCallback(() => {
    avatarActionState.clearSelection();
    setMobileMapOpen(false);
    setSelectedDomain(null);
    setSelectedNode(null);
    setSelectedWorldId(null);
    setActiveThreadId(null);
    setActiveVisual(null);
  }, [avatarActionState]);

  const selectDomain = useCallback((domain: DomainId | null) => {
    setActiveVisual(null);
    avatarActionState.clearSelection();
    setSelectedDomain(domain);
    setSelectedNode(null);
  }, [avatarActionState]);

  const selectNode = useCallback(
    (node: SpatialGraphNode | null) => {
      setActiveVisual(null);
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
        notifyProjectClosed(previous);
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
    [avatarActionState, avatarDirector, notifyProjectClosed, selectNode],
  );

  const selectWorldNode = useCallback(
    (node: PortfolioWorldNode) => {
      setActiveVisual(null);
      setMobileMapOpen(false);
      // Tapping the node that is already selected deselects it, falling back
      // to the story it belongs to if there is one.
      if (selectedWorldId === node.id) {
        clearProjectSelection();
        if (activeThreadId && node.family !== "story") {
          setSelectedWorldId(portfolioThreadById.get(activeThreadId)?.nodeId ?? null);
          pushWorldLocation(null, activeThreadId);
        } else {
          showIndex();
          pushWorldLocation(null, null);
        }
        return;
      }

      setSelectedWorldId(node.id);

      // A story is addressed by its thread, not by the node id.
      if (node.family === "story") {
        setActiveThreadId(node.threadId ?? null);
        clearProjectSelection();
        pushWorldLocation(null, node.threadId ?? null);
        return;
      }

      // Stay inside the open story only if this node is part of it.
      const retainedStoryId = activeThreadId &&
        portfolioThreadById.get(activeThreadId)?.members.includes(node.id)
        ? activeThreadId
        : null;

      if (!node.projectSlug) {
        setActiveThreadId(retainedStoryId);
        clearProjectSelection();
        pushWorldLocation(node.id, retainedStoryId);
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
      clearProjectSelection,
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

  const openVisualInMap = useCallback((
    visual: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
  ) => {
    visualTriggerRef.current = trigger;
    setActiveVisual(visual);
    setMobileMapOpen(true);
  }, []);

  const closeVisualInMap = useCallback(() => {
    const trigger = visualTriggerRef.current;
    setActiveVisual(null);
    setMobileMapOpen(false);
    window.setTimeout(() => {
      if (trigger?.isConnected) trigger.focus();
      if (visualTriggerRef.current === trigger) visualTriggerRef.current = null;
    }, 0);
  }, []);

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
      if (event.key !== "Escape") return;
      if (activeVisual) {
        closeVisualInMap();
        return;
      }
      showIndexWithAvatar();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeVisual, closeVisualInMap, showIndexWithAvatar]);

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
        if (!isCurrentTurn()) return;
        await avatarDirector.perform(effects);
      },
      onNotice: () =>
        avatarController.execute({ action: "setState", state: "confused" }),
      onError: () =>
        avatarController.execute({ action: "setState", state: "error" }),
      onComplete: () => avatarDirector.handle({ type: "turn_complete" }),
    }),
    [avatarActionState, avatarController, avatarDirector],
  );

  useEffect(() => {
    const syncWithLocation = () => {
      showIndex();

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
  }, [showIndex]);

  const setAssistantVisibility = useCallback(
    (visible: boolean) => {
      if (!visible) {
        avatarDirector.stop();
        setMobileMapOpen(false);
        const returningToMobileIndex =
          typeof window !== "undefined" && window.innerWidth <= 600;
        if (returningToMobileIndex) {
          showIndexWithAvatar();
          window.setTimeout(() => {
            document
              .querySelector<HTMLButtonElement>(".portfolio-mobile-view-toggle")
              ?.focus();
          }, 0);
        }
      }
      setAssistantOpen(visible);
    },
    [avatarDirector, showIndexWithAvatar],
  );

  const toggleMobileCombinedView = useCallback(() => {
    if (mobileMapOpen) {
      if (activeVisual) setActiveVisual(null);
      setAssistantVisibility(false);
      return;
    }
    setMobileMapOpen(true);
    setAssistantVisibility(true);
  }, [activeVisual, mobileMapOpen, setAssistantVisibility]);

  const showBradleyRecord = useCallback(() => {
    const bradleyNode = portfolioWorldNodes.find(({ id }) => id === "bradley");
    if (bradleyNode) selectWorldNode(bradleyNode);
  }, [selectWorldNode]);

  // The boundary matters more than the Suspense: a stale chunk after a deploy
  // is a load failure, and without it that throw unwound past the composition
  // and took the whole page. The toybox below has had one all along.
  const avatarOverlay = avatarMounted && !toyboxSession.isPlaying ? (
    <AvatarToyboxBoundary onFailure={() => avatarController.markFailed()}>
    <Suspense fallback={null}>
      <AvatarOverlay
        controller={avatarController}
        debug={avatarDebug}
        development={import.meta.env.DEV}
        director={avatarDirector}
        enabled={assistantOpen}
        onEnabledChange={setAssistantVisibility}
        onExpandedPanelChange={registerDirectorConsoleObstacle}
        reducedMotion={reducedMotion}
        registry={avatarRegistry}
        runner={avatarRunner}
      />
    </Suspense>
    </AvatarToyboxBoundary>
  ) : null;
  const portfolioChat = (
    <PortfolioChat
      avatarIntegration={avatarIntegration}
      onLayoutChange={refreshAssistantHome}
      onOpenChange={setAssistantVisibility}
      open={assistantOpen}
      registerAvatarTarget={registerAvatarTarget}
      turnstileSiteKey={getPortfolioChatTurnstileSiteKey()}
    />
  );

  return (
    <main
      className={`experience experience-graph portfolio-composition${mobileMapOpen ? " portfolio-mobile-map-open" : ""}${activeVisual ? " portfolio-visual-open" : ""}`}
      id="main-content"
      tabIndex={-1}
    >
      <PortfolioHeader
        activeView="map"
        onBradleySelect={showBradleyRecord}
        obstacleRef={registerHeaderObstacle}
        overlay
      />
      <section
        aria-label="Spatial portfolio map"
        className={`scene-shell${selectedNode ? " scene-shell-node-open" : ""}${selectedDomain ? " scene-shell-domain-focus" : ""}`}
        id="brain"
      >
        <PortfolioWorld
          activeThreadId={activeThreadId}
          activeVisual={activeVisual}
          onCloseVisual={closeVisualInMap}
          onReset={showIndexWithAvatar}
          onSelect={selectWorldNode}
          registerAvatarStage={registerAvatarStage}
          selectedId={selectedWorldId}
        />

        <div className="scene-copy">
          <h1
            ref={registerHero}
          >
            <EditableText
              path="interface.hero.throughline"
              value={portfolioThroughline}
            />
          </h1>
        </div>

        <>
          <PortfolioReader
              activeThreadId={activeThreadId}
              onOpenVisual={openVisualInMap}
              onReset={showIndexWithAvatar}
              onSelect={selectWorldNode}
              onSelectThread={selectThread}
              registerAvatarTarget={registerAvatarTarget}
              selectedId={selectedWorldId}
            />
            <button
              aria-label={mobileMapOpen ? "Show portfolio index" : "Show portfolio map"}
              aria-pressed={mobileMapOpen}
              className="portfolio-mobile-view-toggle"
              onClick={toggleMobileCombinedView}
              type="button"
            >
              {mobileMapOpen ? (
                <svg
                  aria-hidden="true"
                  className="portfolio-mobile-view-icon"
                  viewBox="0 0 16 16"
                >
                  <circle cx="3" cy="4" r="0.75" />
                  <circle cx="3" cy="8" r="0.75" />
                  <circle cx="3" cy="12" r="0.75" />
                  <path d="M6 4h7M6 8h7M6 12h7" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  className="portfolio-mobile-view-icon"
                  viewBox="0 0 16 16"
                >
                  <path d="m2.25 4 3.5-1.75L10.25 4l3.5-1.75v9.5l-3.5 1.75-4.5-1.75-3.5 1.75V4Z" />
                  <path d="M5.75 2.25v9.5M10.25 4v9.5" />
                </svg>
              )}
            </button>
        </>
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
