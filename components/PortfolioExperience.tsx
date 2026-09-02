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
  RecordAvatarTargetId,
} from "../lib/avatar/contracts";
import { isExactShiftShortcut } from "../lib/dom-keyboard";
import { getPortfolioChatTurnstileSiteKey } from "../lib/portfolio-chat-config";
import {
  isPortfolioWhatNode,
  portfolioThreadById,
  portfolioWhatNodes,
  portfolioWorldNodeById,
  portfolioWorldNodes,
  type PortfolioVisualBlock,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";
import { PortfolioChat } from "./PortfolioChat";
import { PortfolioControlMark } from "./PortfolioNodeMark";
import { PortfolioReader } from "./PortfolioReader";
import { PortfolioWorld } from "./PortfolioWorld";
import { AvatarToyboxBoundary } from "./avatar-toybox/AvatarToyboxBoundary";
import { useAvatarToyboxSession } from "./avatar-toybox/useAvatarToyboxSession";
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
  if (parts[0] === "thread") {
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
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeVisual, setActiveVisual] = useState<PortfolioVisualBlock | null>(null);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  // The dossier's index state, opened from the footer. Any selection, reset,
  // or navigation closes it; it carries no URL of its own.
  const [indexOpen, setIndexOpen] = useState(false);
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
    refreshAssistantHome,
    registerAvatarStage,
    registerAvatarTarget,
    registerDirectorConsoleObstacle,
  } = useAvatarStage({ assistantOpen, reducedMotion });
  const visualTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedWorldNode = selectedWorldId
    ? portfolioWorldNodeById.get(selectedWorldId)
    : undefined;
  const selectedWhatOpen = selectedWorldNode
    ? isPortfolioWhatNode(selectedWorldNode)
    : false;

  const toyboxCollectibles = useMemo(
    () => portfolioWhatNodes.map(({ id, label }) => ({ id, label })),
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
   * notification has to land after React commits. The outgoing selection is
   * captured before it is cleared so index-only transitions stay silent.
  */
  const notifyRecordClosed = useCallback(
    (previousWhatId: string | null) => {
      if (!previousWhatId) return;
      window.setTimeout(
        () => void avatarDirector.handle({ type: "record_close" }),
        0,
      );
    },
    [avatarDirector],
  );

  const clearRecordSelection = useCallback(() => {
    const previousWhatId = avatarActionState.getSelectedWhatId();
    avatarActionState.clearSelection();
    notifyRecordClosed(previousWhatId);
  }, [avatarActionState, notifyRecordClosed]);

  const showHome = useCallback(() => {
    avatarActionState.clearSelection();
    setMobileMapOpen(false);
    setIndexOpen(false);
    setSelectedWorldId(null);
    setActiveThreadId(null);
    setActiveVisual(null);
  }, [avatarActionState]);

  const selectWhatWithAvatar = useCallback(
    (whatId: string) => {
      avatarActionState.selectWhat(whatId);
      const target: RecordAvatarTargetId = `portfolio:record:${whatId}`;
      window.setTimeout(
        () =>
          void avatarDirector.handle({
            type: "record_open",
            target,
          }),
        0,
      );
    },
    [avatarActionState, avatarDirector],
  );

  const selectWorldNode = useCallback(
    (node: PortfolioWorldNode) => {
      setActiveVisual(null);
      setMobileMapOpen(false);
      setIndexOpen(false);
      // Tapping the node that is already selected deselects it, falling back
      // to the story it belongs to if there is one.
      if (selectedWorldId === node.id) {
        clearRecordSelection();
        if (activeThreadId && node.outlineType !== "why") {
          setSelectedWorldId(portfolioThreadById.get(activeThreadId)?.nodeId ?? null);
          pushWorldLocation(null, activeThreadId);
        } else {
          showHome();
          pushWorldLocation(null, null);
        }
        return;
      }

      setSelectedWorldId(node.id);

      // A story is addressed by its thread, not by the node id.
      if (node.outlineType === "why") {
        setActiveThreadId(node.threadId ?? null);
        clearRecordSelection();
        pushWorldLocation(null, node.threadId ?? null);
        return;
      }

      // Stay inside the open story only if this node is part of it.
      const retainedStoryId = activeThreadId &&
        portfolioThreadById.get(activeThreadId)?.members.includes(node.id)
        ? activeThreadId
        : null;

      if (!isPortfolioWhatNode(node)) {
        setActiveThreadId(retainedStoryId);
        clearRecordSelection();
        pushWorldLocation(node.id, retainedStoryId);
        return;
      }

      selectWhatWithAvatar(node.id);
      setActiveThreadId(retainedStoryId);
      pushWorldLocation(node.id, retainedStoryId);
    },
    [
      activeThreadId,
      clearRecordSelection,
      selectedWorldId,
      selectWhatWithAvatar,
      showHome,
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

  const showHomeWithAvatar = useCallback(() => {
    const hadWhat = Boolean(avatarActionState.getSelectedWhatId());
    const hadComposition = Boolean(selectedWorldId || activeThreadId);
    showHome();
    if (hadComposition) pushWorldLocation(null, null);
    if (hadWhat) {
      window.setTimeout(
        () => void avatarDirector.handle({ type: "record_close" }),
        0,
      );
    }
  }, [activeThreadId, avatarActionState, avatarDirector, selectedWorldId, showHome]);

  const openIndex = useCallback(() => {
    showHomeWithAvatar();
    setIndexOpen(true);
  }, [showHomeWithAvatar]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activeVisual) {
        closeVisualInMap();
        return;
      }
      showHomeWithAvatar();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeVisual, closeVisualInMap, showHomeWithAvatar]);

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
      showHome();

      const { nodeId, threadId } = readWorldLocation();
      const story = threadId ? portfolioThreadById.get(threadId) : undefined;
      const node = nodeId ? portfolioWorldNodeById.get(nodeId) : undefined;
      if (story) {
        setActiveThreadId(story.id);
        setSelectedWorldId(node?.id ?? story.nodeId);
        if (node && isPortfolioWhatNode(node)) {
          avatarActionState.selectWhat(node.id);
        }
      } else if (node) {
        setSelectedWorldId(node.id);
        if (isPortfolioWhatNode(node)) {
          avatarActionState.selectWhat(node.id);
        }
      }
    };
    window.addEventListener("popstate", syncWithLocation);
    syncWithLocation();
    return () => window.removeEventListener("popstate", syncWithLocation);
  }, [avatarActionState, showHome]);

  const setAssistantVisibility = useCallback(
    (visible: boolean) => {
      if (!visible) {
        avatarDirector.stop();
        setMobileMapOpen(false);
        const returningToMobileIndex =
          typeof window !== "undefined" && window.innerWidth <= 900;
        if (returningToMobileIndex) {
          showHomeWithAvatar();
          window.setTimeout(() => {
            document
              .querySelector<HTMLButtonElement>(".portfolio-mobile-view-control")
              ?.focus();
          }, 0);
        }
      }
      setAssistantOpen(visible);
    },
    [avatarDirector, showHomeWithAvatar],
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
      className={`experience portfolio-composition${mobileMapOpen ? " portfolio-mobile-map-open" : ""}${activeVisual ? " portfolio-visual-open" : ""}`}
      id="main-content"
      tabIndex={-1}
    >
      <section
        aria-label="Spatial portfolio map"
        className={`scene-shell${selectedWhatOpen ? " scene-shell-node-open" : ""}`}
        id="brain"
      >
        <PortfolioWorld
          activeThreadId={activeThreadId}
          activeVisual={activeVisual}
          onCloseVisual={closeVisualInMap}
          onReset={showHomeWithAvatar}
          onSelect={selectWorldNode}
          registerAvatarStage={registerAvatarStage}
          selectedId={selectedWorldId}
        />

        <>
          <PortfolioReader
              activeThreadId={activeThreadId}
              indexOpen={indexOpen}
              onOpenIndex={openIndex}
              onOpenVisual={openVisualInMap}
              onReset={showHomeWithAvatar}
              onSelect={selectWorldNode}
              onSelectThread={selectThread}
              registerAvatarTarget={registerAvatarTarget}
              selectedId={selectedWorldId}
            />
            {/* The phone's one view control, drawn as a node mark at the
                footer band's right edge: the brain opens the map with the
                assistant; the index glyph returns to the dossier. */}
            <PortfolioControlMark
              aria-label={mobileMapOpen ? "Show portfolio home" : "Show portfolio map"}
              aria-pressed={mobileMapOpen}
              className="portfolio-mobile-view-control"
              kind={mobileMapOpen ? "index" : "map"}
              label={mobileMapOpen ? "Index" : "Map"}
              onClick={toggleMobileCombinedView}
            />
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
