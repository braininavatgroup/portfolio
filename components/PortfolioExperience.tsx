"use client";

import {
  lazy,
  Suspense,
  useEffect,
  useReducer,
  useState,
  type MouseEvent,
} from "react";
import { visibleGraphNodes } from "../lib/graph-emphasis";
import { domains, type DomainId } from "../lib/portfolio";
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
  const dossier = selectedNode
    ? getPortfolioDossier(selectedNode)
    : undefined;
  const visibleNodes = visibleGraphNodes(portfolioNodes, {
    selectedDomain,
    selectedProjectId: selectedNode?.projectId ?? null,
  });

  useEffect(() => {
    dispatch({ type: initialPhase === "graph" ? "SHOW_GRAPH" : "RESET" });
  }, [initialPhase]);

  useEffect(() => {
    if (transition.phase !== "entering") return;
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
      setSelectedDomain(null);
      setSelectedNode(null);
      setKeyboardNodeId(null);
      setPose("idle");
      dispatch({ type: graphRequested ? "SHOW_GRAPH" : "RESET" });
    };
    window.addEventListener("popstate", syncWithLocation);
    return () => window.removeEventListener("popstate", syncWithLocation);
  }, []);

  function showIndex() {
    setSelectedDomain(null);
    setSelectedNode(null);
    setKeyboardNodeId(null);
  }

  function selectDomain(domain: DomainId | null) {
    setSelectedDomain(domain);
    setSelectedNode(null);
    setKeyboardNodeId(null);
  }

  function selectNode(node: SpatialGraphNode | null) {
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
    setSelectedDomain(domain);
    setSelectedNode(node);
  }

  function enterMap() {
    if (transition.phase !== "body") return;
    window.history.pushState({}, "", "/?view=graph");
    dispatch({ type: "ENTER" });
  }

  function handleLandingClick(event: MouseEvent<HTMLElement>) {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("a, button, input, textarea, select, .portfolio-chat")
    ) {
      return;
    }
    enterMap();
  }

  return (
    <main
      className={`experience experience-${transition.phase}`}
      data-theme="light"
      id="main-content"
    >
      <TransitionStatus phase={transition.phase} />
      <PortfolioHeader
        activeView={transition.phase === "body" ? "bradley" : "map"}
        overlay
      />
      {/* Any non-control click on the landing canvas enters. Header Map is
          the explicit keyboard path; nested controls remain independent. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <section
        aria-label={
          transition.phase === "body"
            ? "Bradley Berkman landing"
            : "Spatial portfolio map"
        }
        className={`scene-shell${selectedNode ? " scene-shell-node-open" : ""}${selectedDomain ? " scene-shell-domain-focus" : ""}`}
        id="brain"
        onClick={handleLandingClick}
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
            onNodeSelect={selectNode}
          />
        </Suspense>

        <div className="scene-copy">
          <h1>I find where judgment matters, then build the system around it.</h1>
        </div>

        {transition.phase === "graph" ? (
          <>
            <PortfolioDossier
              dossier={dossier}
              onDomainSelect={selectDomain}
              onShowIndex={showIndex}
              selectedDomain={selectedDomain}
            />

            <KeyboardNavigator
              nodes={visibleNodes}
              onNodeFocus={setKeyboardNodeId}
              onNodeSelect={selectNode}
              selectedNodeId={selectedNode?.id ?? null}
            />
          </>
        ) : null}

        <PortfolioChat onPoseChange={setPose} />
      </section>
    </main>
  );
}
