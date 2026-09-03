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
import type { PortfolioResponseEffects } from "../lib/avatar/contracts";
import { getPortfolioChatTurnstileSiteKey } from "../lib/portfolio-chat-config";
import { trackPortfolioInsight } from "../lib/portfolio-analytics";
import type { GuideEvidenceTarget } from "../lib/portfolio-guide-citations";
import {
  portfolioThreadById,
  portfolioWorldNodeById,
  portfolioWorldNodes,
  type PortfolioVisualBlock,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";
import type { ReadingRoomView } from "../lib/reading-room-layout";
import { PortfolioChat } from "./PortfolioChat";
import { PortfolioFeedback } from "./PortfolioFeedback";
import {
  PortfolioReadingRoom,
  type ReadingRoomMobileTab,
  type ReadingRoomMobileTabRequest,
  type ReadingRoomViewRequest,
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
  const [activeVisual, setActiveVisual] = useState<{
    block: PortfolioVisualBlock;
    initialFrame: number;
  } | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [guideHasThread, setGuideHasThread] = useState(false);
  const [guideResetSignal, setGuideResetSignal] = useState(0);
  const [mobileTabRequest, setMobileTabRequest] = useState<ReadingRoomMobileTabRequest>();
  const [viewRequest, setViewRequest] = useState<ReadingRoomViewRequest>();
  const {
    avatarMounted,
    avatarRuntime,
    refreshAvatarDock,
    registerAvatarDock,
    registerAvatarStage,
  } = useAvatarStage({ assistantOpen: guideVisible, reducedMotion });
  const brainFood = useBrainFoodSession({
    avatarRuntime,
    edibleNodeCount: portfolioWorldNodes.length - 1,
    enabled: avatarMounted,
    reducedMotion,
  });
  const visualTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedWorldNode = selectedWorldId
    ? portfolioWorldNodeById.get(selectedWorldId)
    : undefined;

  const requestMobileTab = useCallback((tab: ReadingRoomMobileTab) => {
    setMobileTabRequest((current) => ({ key: (current?.key ?? 0) + 1, tab }));
  }, []);

  const requestView = useCallback((view: ReadingRoomView) => {
    setViewRequest((current) => ({ key: (current?.key ?? 0) + 1, view }));
  }, []);

  const showHome = useCallback(() => {
    setSelectedWorldId(null);
    setActiveThreadId(null);
    setActiveVisual(null);
  }, []);

  const navigateToWorldNode = useCallback((
    node: PortfolioWorldNode,
    selectionSource: string,
  ) => {
    setActiveVisual(null);
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
    // Only a selection or thread is mirrored into the URL; an open visual is
    // not, so closing one from home must not push a second home entry.
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

  const openVisualInMap = useCallback((
    visual: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
    initialFrame = 0,
  ) => {
    visualTriggerRef.current = trigger;
    setActiveVisual({ block: visual, initialFrame });
    requestView("map");
  }, [requestView]);

  const closeVisualInMap = useCallback(() => {
    const trigger = visualTriggerRef.current;
    setActiveVisual(null);
    requestMobileTab("reader");
    window.setTimeout(() => {
      if (trigger?.isConnected) trigger.focus();
      if (visualTriggerRef.current === trigger) visualTriggerRef.current = null;
    }, 0);
  }, [requestMobileTab]);

  const resetGuide = useCallback(() => {
    setGuideResetSignal((signal) => signal + 1);
  }, []);

  const escapeBeforeRoom = useCallback(() => {
    if (brainFood.active) return true;
    if (!activeVisual) return false;
    closeVisualInMap();
    return true;
  }, [activeVisual, brainFood.active, closeVisualInMap]);

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

  const avatarIntegration = useMemo(
    () => ({
      onTurnStart: () => {
        avatarRuntime.cancel();
      },
      onFirstText: () => {
        void avatarRuntime.react();
      },
      onEffects: (effects: PortfolioResponseEffects) => {
        if (effects.avatarAction === "swim_lap") {
          void avatarRuntime.queueSwimLap();
        }
      },
    }),
    [avatarRuntime],
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
      onOpenVisual={openVisualInMap}
      onReset={showHomeAndSyncLocation}
      onSelect={selectFromReader}
      onSelectThread={selectThreadFromReader}
      selectedId={selectedWorldId}
    />
  );
  const map = (
    <PortfolioWorld
      activeThreadId={activeThreadId}
      activeVisual={activeVisual?.block}
      activeVisualFrame={activeVisual?.initialFrame}
      brainFood={brainFood}
      onCloseVisual={closeVisualInMap}
      onReset={showHomeAndSyncLocation}
      onSelect={selectFromMap}
      registerAvatarStage={registerAvatarStage}
      selectedId={selectedWorldId}
    />
  );
  const guide = (
    <PortfolioChat
      avatarIntegration={avatarIntegration}
      onLayoutChange={refreshAvatarDock}
      onNavigateEvidence={navigateGuideEvidence}
      onThreadStateChange={setGuideHasThread}
      registerAvatarDock={registerAvatarDock}
      resetSignal={guideResetSignal}
      turnstileSiteKey={getPortfolioChatTurnstileSiteKey()}
    />
  );

  return (
    <main
      className={`experience portfolio-composition${activeVisual ? " portfolio-visual-open" : ""}`}
      id="main-content"
      tabIndex={-1}
    >
      <PortfolioReadingRoom
        activeThreadId={activeThreadId}
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
        viewRequest={viewRequest}
      />
      {avatarOverlay}
      <PortfolioFeedback />
    </main>
  );
}
