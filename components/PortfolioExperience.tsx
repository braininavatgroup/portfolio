"use client";

import { PortfolioControlMark } from "./PortfolioNodeMark";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { PortfolioResponseEffects } from "../lib/avatar/contracts";
import { trackPortfolioInsight } from "../lib/portfolio-analytics";
import type { GuideEvidenceTarget } from "../lib/portfolio-guide-citations";
import {
  portfolioThreadById,
  portfolioWorldNodeById,
  portfolioWorldNodes,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";
import { PortfolioChat } from "./PortfolioChat";
import { PortfolioFeedback } from "./PortfolioFeedback";
import {
  PortfolioReadingRoom,
  type ReadingRoomMobileTab,
  type ReadingRoomMobileTabRequest,
} from "./PortfolioReadingRoom";
import { PortfolioReader } from "./PortfolioReader";
import { PortfolioWorld } from "./PortfolioWorld";
import { AvatarBoundary } from "./avatar/AvatarBoundary";
import { useAvatarStage } from "./useAvatarStage";
import { useBrainFoodSession } from "./useBrainFoodSession";

const AvatarOverlay = lazy(() =>
  import("./avatar/AvatarOverlay").then((module) => ({
    default: module.AvatarOverlay,
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
  if (window.location.pathname.startsWith("/index/")) {
    return { threadId: null, nodeId: decodeURIComponent(window.location.pathname.split("/")[2] ?? "") };
  }
  const parts = window.location.hash.slice(1).split("/").filter(Boolean);
  if (parts[0] === "thread") {
    return { threadId: parts[1] ?? null, nodeId: parts[2] ?? null };
  }
  return { threadId: null, nodeId: parts[0] ?? null };
}

function pushWorldLocation(nodeId: string | null, threadId: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "graph");
  const targetId = nodeId ?? (threadId ? portfolioThreadById.get(threadId)?.nodeId : null);
  url.pathname = targetId ? `/index/${targetId}` : "/";
  url.hash = "";
  window.history.pushState({ nodeId, threadId }, "", url);
}

export function PortfolioExperience({ initialNodeId = null }: { initialNodeId?: string | null } = {}) {
  const reducedMotion = useReducedMotion();
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(initialNodeId);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    initialNodeId ? portfolioWorldNodeById.get(initialNodeId)?.threadId ?? null : null,
  );
  const [gameNotice, setGameNotice] = useState("");
  const [avatarHidden, setAvatarHidden] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [guideHasThread, setGuideHasThread] = useState(false);
  const [guideResetSignal, setGuideResetSignal] = useState(0);
  const [mobileTabRequest, setMobileTabRequest] = useState<ReadingRoomMobileTabRequest>();
  const {
    avatarMounted,
    avatarRuntime,
    refreshAvatarDock,
    registerAvatarDock,
    registerAvatarStage,
  } = useAvatarStage({ assistantOpen: guideVisible && !avatarHidden, reducedMotion });
  const avatarStatus = useSyncExternalStore<"ready" | "loading" | "unavailable">(avatarRuntime.subscribe,
    () => avatarRuntime.getSnapshot().failed ? "unavailable" : avatarRuntime.getSnapshot().ready ? "ready" : "loading",
    () => "loading",
  );
  const [gameSupported, setGameSupported] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1020px)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const update = () => setGameSupported(desktop.matches && !coarse.matches);
    update();
    desktop.addEventListener("change", update);
    coarse.addEventListener("change", update);
    return () => { desktop.removeEventListener("change", update); coarse.removeEventListener("change", update); };
  }, []);
  const brainFood = useBrainFoodSession({
    avatarRuntime,
    edibleNodeCount: portfolioWorldNodes.length - 1,
    enabled: avatarMounted && !avatarHidden && avatarStatus === "ready" && !reducedMotion,
    reducedMotion,
  });
  const selectedWorldNode = selectedWorldId
    ? portfolioWorldNodeById.get(selectedWorldId)
    : undefined;

  const requestMobileTab = useCallback((tab: ReadingRoomMobileTab) => {
    setMobileTabRequest((current) => ({ key: (current?.key ?? 0) + 1, tab }));
  }, []);

  const showHome = useCallback(() => {
    setSelectedWorldId(null);
    setActiveThreadId(null);
  }, []);

  const navigateToWorldNode = useCallback((
    node: PortfolioWorldNode,
    selectionSource: string,
  ) => {
    setSelectedWorldId(node.id);
    if (node.outlineType === "why") {
      setActiveThreadId(node.threadId ?? null);
      if (node.threadId) {
        trackPortfolioInsight("content_open", {
          content_id: node.threadId,
          content_kind: "thread",
          selection_source: selectionSource,
        });
      }
      pushWorldLocation(null, node.threadId ?? null);
      return;
    }
    setActiveThreadId(null);
    trackPortfolioInsight("content_open", {
      content_id: node.id,
      content_kind: "record",
      selection_source: selectionSource,
    });
    pushWorldLocation(node.id, null);
  }, []);

  const showHomeAndSyncLocation = useCallback(() => {
    // Only a selection or thread is mirrored into the URL; Reader media is
    // not, so returning home without a selection must not push another entry.
    const hadLocation = Boolean(selectedWorldId || activeThreadId);
    showHome();
    requestMobileTab("reader");
    if (hadLocation) pushWorldLocation(null, null);
  }, [activeThreadId, requestMobileTab, selectedWorldId, showHome]);

  const selectWorldNode = useCallback((
    node: PortfolioWorldNode,
    selectionSource: string,
  ) => {
    if (selectedWorldId === node.id) {
      showHomeAndSyncLocation();
      return;
    }
    navigateToWorldNode(node, selectionSource);
  }, [navigateToWorldNode, selectedWorldId, showHomeAndSyncLocation]);

  const selectThread = useCallback((threadId: string, selectionSource: string) => {
    const threadNode = portfolioWorldNodes.find((node) => node.threadId === threadId);
    if (threadNode) selectWorldNode(threadNode, selectionSource);
  }, [selectWorldNode]);

  const selectFromContents = useCallback(
    (node: PortfolioWorldNode) => selectWorldNode(node, "contents"),
    [selectWorldNode],
  );
  const selectThreadFromContents = useCallback(
    (threadId: string) => selectThread(threadId, "contents"),
    [selectThread],
  );
  const selectFromMap = useCallback(
    (node: PortfolioWorldNode) => selectWorldNode(node, "map"),
    [selectWorldNode],
  );
  const selectFromReader = useCallback(
    (node: PortfolioWorldNode) => selectWorldNode(node, "reader"),
    [selectWorldNode],
  );
  const selectThreadFromReader = useCallback(
    (threadId: string) => selectThread(threadId, "reader"),
    [selectThread],
  );

  const resetGuide = useCallback(() => {
    setGuideResetSignal((signal) => signal + 1);
  }, []);

  const escapeBeforeRoom = useCallback(() => {
    return brainFood.gameMode;
  }, [brainFood.gameMode]);

  const navigateGuideEvidence = useCallback((target: GuideEvidenceTarget) => {
    if (target.type === "home") {
      trackPortfolioInsight("guide_evidence", {
        evidence_source: "guide",
        target_kind: "home",
      });
      showHomeAndSyncLocation();
      return;
    }
    if (target.type === "thread") {
      const thread = portfolioThreadById.get(target.id);
      const node = thread ? portfolioWorldNodeById.get(thread.nodeId) : undefined;
      if (node) {
        trackPortfolioInsight("guide_evidence", {
          evidence_source: "guide",
          target_id: target.id,
          target_kind: "thread",
        });
        navigateToWorldNode(node, "guide");
      }
      return;
    }
    const node = portfolioWorldNodeById.get(target.id);
    if (node) {
      trackPortfolioInsight("guide_evidence", {
        evidence_source: "guide",
        target_id: target.id,
        target_kind: "record",
      });
      navigateToWorldNode(node, "guide");
    }
  }, [navigateToWorldNode, showHomeAndSyncLocation]);

  const startBrainFood = brainFood.start;
  const avatarIntegration = useMemo(
    () => ({
      onTurnStart: () => {
        avatarRuntime.cancel();
      },
      onFirstText: () => {
        if (!reducedMotion && !avatarHidden) void avatarRuntime.react();
      },
      onEffects: (effects: PortfolioResponseEffects) => {
        if (effects.avatarAction === "swim_lap") {
          void avatarRuntime.queueSwimLap();
        } else if (effects.avatarAction === "stroll") {
          void avatarRuntime.queueStroll();
        } else if (effects.avatarAction === "wave") {
          void avatarRuntime.queueWave();
        } else if (effects.avatarAction === "dance") {
          void avatarRuntime.queueDance();
        } else if (effects.avatarAction === "brain_food") {
          const started = startBrainFood();
          setGameNotice(started ? "" : "Brain Food needs a keyboard and a larger window, with Bradley ready to play.");
        } else if (effects.avatarAction === "turn") {
          void avatarRuntime.queueTurn();
        }
      },
    }),
    [avatarRuntime, startBrainFood, reducedMotion, avatarHidden],
  );

  useEffect(() => {
    const syncWithLocation = () => {
      showHome();
      requestMobileTab("reader");

      const { nodeId, threadId } = readWorldLocation();
      const node = nodeId ? portfolioWorldNodeById.get(nodeId) : undefined;
      const story = node?.outlineType === "why"
        ? portfolioThreadById.get(node.threadId ?? "")
        : node
          ? undefined
          : threadId
            ? portfolioThreadById.get(threadId)
            : undefined;
      if (story) {
        setActiveThreadId(story.id);
        setSelectedWorldId(story.nodeId);
        trackPortfolioInsight("content_open", {
          content_id: story.id,
          content_kind: "thread",
          selection_source: "url",
        });
      } else if (node) {
        setSelectedWorldId(node.id);
        trackPortfolioInsight("content_open", {
          content_id: node.id,
          content_kind: "record",
          selection_source: "url",
        });
      }
    };
    window.addEventListener("popstate", syncWithLocation);
    syncWithLocation();
    return () => window.removeEventListener("popstate", syncWithLocation);
  }, [requestMobileTab, showHome]);

  const avatarOverlay = avatarMounted ? (
    <AvatarBoundary onFailure={() => avatarRuntime.markFailed()}>
      <Suspense fallback={null}>
        <AvatarOverlay reducedMotion={reducedMotion} runtime={avatarRuntime} />
      </Suspense>
    </AvatarBoundary>
  ) : null;

  const reader = (
    <PortfolioReader
      activeThreadId={activeThreadId}
      onReset={showHomeAndSyncLocation}
      onSelect={selectFromReader}
      onSelectThread={selectThreadFromReader}
      selectedId={selectedWorldId}
    />
  );
  const map = (
    <PortfolioWorld
      activeThreadId={activeThreadId}
      brainFood={{...brainFood, active: brainFood.gameMode}}
      onReset={showHomeAndSyncLocation}
      onSelect={selectFromMap}
      registerAvatarStage={registerAvatarStage}
      selectedId={selectedWorldId}
    />
  );
  const guide = (
    <PortfolioChat
      avatarIntegration={avatarIntegration}
      actionAvailability={{ status: avatarHidden ? "hidden" : avatarStatus, reducedMotion, gameSupported }}
      onLayoutChange={refreshAvatarDock}
      onNavigateEvidence={navigateGuideEvidence}
      onThreadStateChange={setGuideHasThread}
      registerAvatarDock={registerAvatarDock}
      resetSignal={guideResetSignal}
    />
  );

  return (
    <main
      className="experience portfolio-composition"
      data-game-mode={brainFood.gameMode}
      id="main-content"
      tabIndex={-1}
    >
      <PortfolioReadingRoom
        avatarHidden={avatarHidden}
        onToggleAvatar={() => { brainFood.cancel(); setAvatarHidden(hidden => !hidden); }}
        activeThreadId={activeThreadId}
        gameMode={brainFood.gameMode}
        guide={guide}
        guideHasThread={guideHasThread}
        map={map}
        mobileTabRequest={mobileTabRequest}
        onEscapeBeforeRoom={escapeBeforeRoom}
        onGuideReset={resetGuide}
        onGuideVisibilityChange={setGuideVisible}
        onHome={showHomeAndSyncLocation}
        onLayoutChange={refreshAvatarDock}
        onSelect={selectFromContents}
        onSelectThread={selectThreadFromContents}
        reader={reader}
        selectedId={selectedWorldId}
        selectedSubject={selectedWorldNode ?? null}
      />
      {brainFood.gameMode ? <PortfolioControlMark aria-label="Exit Brain Food" kind="close" className="portfolio-brain-food-exit" onClick={brainFood.cancel} /> : null}
      {gameNotice ? <p role="status" className="portfolio-game-notice">{gameNotice}</p> : null}
      {avatarOverlay}
      <PortfolioFeedback />
    </main>
  );
}
