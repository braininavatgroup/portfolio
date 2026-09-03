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
import {
  isPortfolioWhatNode,
  portfolioThreadById,
  portfolioWorldNodeById,
  portfolioWorldNodes,
  type PortfolioVisualBlock,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";
import { PortfolioChat } from "./PortfolioChat";
import { PortfolioControlMark } from "./PortfolioNodeMark";
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
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  // The dossier's index state, opened from the footer. Any selection, reset,
  // or navigation closes it; it carries no URL of its own.
  const [indexOpen, setIndexOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const {
    avatarMounted,
    avatarRuntime,
    refreshAvatarDock,
    registerAvatarDock,
    registerAvatarStage,
  } = useAvatarStage({ assistantOpen, reducedMotion });
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
  const selectedWhatOpen = selectedWorldNode
    ? isPortfolioWhatNode(selectedWorldNode)
    : false;

  const showHome = useCallback(() => {
    setMobileMapOpen(false);
    setIndexOpen(false);
    setSelectedWorldId(null);
    setActiveThreadId(null);
    setActiveVisual(null);
  }, []);

  const selectWorldNode = useCallback(
    (node: PortfolioWorldNode) => {
      setActiveVisual(null);
      setMobileMapOpen(false);
      setIndexOpen(false);
      // Tapping the node that is already selected deselects it, back to home.
      if (selectedWorldId === node.id) {
        showHome();
        pushWorldLocation(null, null);
        return;
      }

      setSelectedWorldId(node.id);

      // A story is addressed by its thread, not by the node id.
      if (node.outlineType === "why") {
        setActiveThreadId(node.threadId ?? null);
        pushWorldLocation(null, node.threadId ?? null);
        return;
      }

      // Every record has its own composition. Choosing a member from inside
      // a Story leaves the Story: the four Stories are the entry point at
      // rest, not a mode the map stays locked in.
      setActiveThreadId(null);

      if (!isPortfolioWhatNode(node)) {
        pushWorldLocation(node.id, null);
        return;
      }

      pushWorldLocation(node.id, null);
    },
    [selectedWorldId, showHome],
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
    initialFrame = 0,
  ) => {
    visualTriggerRef.current = trigger;
    setActiveVisual({ block: visual, initialFrame });
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

  const showHomeAndSyncLocation = useCallback(() => {
    const hadComposition = Boolean(selectedWorldId || activeThreadId);
    showHome();
    if (hadComposition) pushWorldLocation(null, null);
  }, [activeThreadId, selectedWorldId, showHome]);

  const openIndex = useCallback(() => {
    showHomeAndSyncLocation();
    setIndexOpen(true);
  }, [showHomeAndSyncLocation]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (brainFood.active) return;
      if (activeVisual) {
        closeVisualInMap();
        return;
      }
      showHomeAndSyncLocation();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeVisual, brainFood.active, closeVisualInMap, showHomeAndSyncLocation]);

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

      const { nodeId, threadId } = readWorldLocation();
      const node = nodeId ? portfolioWorldNodeById.get(nodeId) : undefined;
      // A record in the address wins: an older `#thread/<id>/<node>` link
      // still opens the record, in its own composition. A Story node
      // resolves to its thread either way.
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
      } else if (node) {
        setSelectedWorldId(node.id);
      }
    };
    window.addEventListener("popstate", syncWithLocation);
    syncWithLocation();
    return () => window.removeEventListener("popstate", syncWithLocation);
  }, [showHome]);

  const setAssistantVisibility = useCallback(
    (visible: boolean) => {
      if (!visible) {
        setMobileMapOpen(false);
        const returningToMobileIndex =
          typeof window !== "undefined" && window.innerWidth <= 900;
        if (returningToMobileIndex) {
          showHomeAndSyncLocation();
          window.setTimeout(() => {
            document
              .querySelector<HTMLButtonElement>(".portfolio-mobile-view-control")
              ?.focus();
          }, 0);
        }
      }
      setAssistantOpen(visible);
    },
    [showHomeAndSyncLocation],
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

  const avatarOverlay = avatarMounted ? (
    <AvatarBoundary onFailure={() => avatarRuntime.markFailed()}>
    <Suspense fallback={null}>
      <AvatarOverlay
        reducedMotion={reducedMotion}
        runtime={avatarRuntime}
      />
    </Suspense>
    </AvatarBoundary>
  ) : null;
  const portfolioChat = (
    <PortfolioChat
      avatarIntegration={avatarIntegration}
      hidden={activeVisual !== null}
      onLayoutChange={refreshAvatarDock}
      onOpenChange={setAssistantVisibility}
      open={assistantOpen}
      registerAvatarDock={registerAvatarDock}
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
          activeVisual={activeVisual?.block}
          activeVisualFrame={activeVisual?.initialFrame}
          onCloseVisual={closeVisualInMap}
          brainFood={brainFood}
          onReset={showHomeAndSyncLocation}
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
              onReset={showHomeAndSyncLocation}
              onSelect={selectWorldNode}
              onSelectThread={selectThread}
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
    </main>
  );
}
