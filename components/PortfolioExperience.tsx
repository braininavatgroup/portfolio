"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { domains, type DomainId } from "../lib/portfolio";
import { getPortfolioDossier } from "../lib/portfolio-dossier";
import {
  portfolioNodes,
  type SpatialGraphNode,
} from "../lib/spatial-graph";
import { KeyboardNavigator } from "./KeyboardNavigator";
import { PortfolioChat } from "./PortfolioChat";
import { PortfolioDossier } from "./PortfolioDossier";
import { PortfolioHeader } from "./PortfolioHeader";
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

export function PortfolioExperience() {
  const reducedMotion = useReducedMotion();
  const [selectedDomain, setSelectedDomain] = useState<DomainId | null>(null);
  const [pose, setPose] = useState<PoseState>("idle");
  const [keyboardNodeId, setKeyboardNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<SpatialGraphNode | null>(null);
  const keyboardControlRef = useRef<HTMLButtonElement>(null);
  const dossier = selectedNode
    ? getPortfolioDossier(selectedNode)
    : undefined;

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

    const nextDossier = getPortfolioDossier(node);
    if (!nextDossier) {
      showIndex();
      return;
    }

    const domain = domains.find(({ id }) => id === node.groupId)?.id ?? null;
    setSelectedDomain(domain);
    setSelectedNode(node);
  }

  return (
    <main
      className="experience experience-graph"
      data-theme="light"
      id="main-content"
    >
      <PortfolioHeader activeView="map" onHome={showIndex} overlay />
      <section
        aria-label="Spatial portfolio map"
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
            nodes={portfolioNodes}
            phase="graph"
            pose={pose}
            selectedDomain={selectedDomain}
            reducedMotion={reducedMotion}
            focusedNodeId={keyboardNodeId}
            selectedNodeId={selectedNode?.id ?? null}
            onNodeSelect={selectNode}
          />
        </Suspense>

        <PortfolioDossier
          dossier={dossier}
          key={selectedNode?.id ?? "portfolio-index"}
          onDomainSelect={selectDomain}
          onShowIndex={showIndex}
          selectedDomain={selectedDomain}
        />

        <div className="map-keyboard-tools">
          <KeyboardNavigator
            controlRef={keyboardControlRef}
            nodes={portfolioNodes}
            onNodeFocus={setKeyboardNodeId}
            onNodeSelect={selectNode}
            selectedNodeId={selectedNode?.id ?? null}
          />
        </div>

        <PortfolioChat onPoseChange={setPose} />
      </section>
    </main>
  );
}
