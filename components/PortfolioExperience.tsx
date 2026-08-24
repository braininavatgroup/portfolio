"use client";

import Link from "next/link";
import { lazy, Suspense, useEffect, useReducer, useRef, useState } from "react";
import { getEntity } from "../lib/portfolio-data";
import { domains, type DomainId } from "../lib/portfolio";
import {
  portfolioNodes,
  type SpatialGraphNode,
} from "../lib/spatial-graph";
import {
  transitionDuration,
  transitionReducer,
} from "../lib/transition";
import { TransitionStatus } from "./TransitionStatus";
import { KeyboardNavigator } from "./KeyboardNavigator";
import { NodeDrawer } from "./NodeDrawer";
import { PortfolioChat } from "./PortfolioChat";
import { FrameSampler } from "./FrameSampler";
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
  initialPhase?: "body" | "graph";
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
  const keyboardControlRef = useRef<HTMLButtonElement>(null);
  const selectedEntities =
    selectedNode && selectedNode.role !== "root"
      ? selectedNode.entityIds.flatMap((entityId) => {
          const entity = getEntity(entityId);
          return entity ? [entity] : [];
        })
      : [];

  useEffect(() => {
    if (transition.phase !== "entering") return;
    const timer = window.setTimeout(
      () => dispatch({ type: "COMPLETE" }),
      transitionDuration(reducedMotion),
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, transition.phase, transition.run]);

  function resetExperience() {
    setSelectedDomain(null);
    setSelectedNode(null);
    setKeyboardNodeId(null);
    setPose("idle");
    dispatch({ type: "RESET" });
  }

  return (
    <main
      className={`experience experience-${transition.phase}`}
      data-theme="light"
      id="main-content"
    >
      <TransitionStatus phase={transition.phase} />
      <header className="experience-header">
        <Link className="wordmark" href="/" onClick={resetExperience}>Bradley Berkman</Link>
        {transition.phase === "graph" ? (
          <nav aria-label="Portfolio views">
            <span aria-current="page">Map</span>
            <Link href="/work">Project index</Link>
            <button type="button" onClick={resetExperience}>
              Replay intro
            </button>
          </nav>
        ) : null}
      </header>

      <section
        aria-label="Spatial portfolio preview"
        className={`scene-shell${selectedNode ? " scene-shell-node-open" : ""}`}
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
            phase={transition.phase}
            pose={pose}
            selectedDomain={selectedDomain}
            reducedMotion={reducedMotion}
            focusedNodeId={keyboardNodeId}
            selectedNodeId={selectedNode?.id ?? null}
            onNodeSelect={setSelectedNode}
            onEnter={() => dispatch({ type: "ENTER" })}
          />
        </Suspense>
        {selectedNode && selectedNode.role !== "root" ? (
          <NodeDrawer
            node={selectedNode}
            entities={selectedEntities}
            onClose={() => setSelectedNode(null)}
            returnFocusRef={keyboardControlRef}
          />
        ) : null}

        <div className="scene-copy">
          <p className="eyebrow">Bradley Berkman portfolio</p>
          <h1>I find where judgment matters, then build the system around it.</h1>
          <p>
            Start with the brain, then follow the work outward.
          </p>
          {transition.phase === "body" ? (
            <button
              className="enter-button"
              type="button"
              onClick={() => dispatch({ type: "ENTER" })}
            >
              Explore the work
            </button>
          ) : null}
          {transition.phase === "entering" ? (
            <p className="transition-label">Moving through the glass…</p>
          ) : null}
        </div>
        {transition.phase === "graph" ? (
          <aside className="graph-toolbar" aria-label="Guided graph tour">
            <p className="eyebrow">Portfolio map</p>
            <p>Follow a cable from instinct through approach to output.</p>
            <div className="domain-controls" aria-label="Guided domain tour">
              {domains.map((domain) => (
                <button
                  aria-pressed={selectedDomain === domain.id}
                  key={domain.id}
                  type="button"
                  onClick={() => setSelectedDomain(domain.id)}
                >
                  {domain.label}
                </button>
              ))}
              <button
                aria-pressed={selectedDomain === null}
                type="button"
                onClick={() => setSelectedDomain(null)}
              >
                Overview
              </button>
            </div>
            <ul className="node-legend" aria-label="Map legend">
              <li className="legend-spec">Instinct</li>
              <li className="legend-system">Approach</li>
              <li className="legend-artifact">Output</li>
            </ul>
            <KeyboardNavigator
              controlRef={keyboardControlRef}
              nodes={portfolioNodes}
              onNodeFocus={setKeyboardNodeId}
              onNodeSelect={setSelectedNode}
              selectedNodeId={selectedNode?.id ?? null}
            />
          </aside>
        ) : null}
        <PortfolioChat onPoseChange={setPose} />
        <FrameSampler />
      </section>
    </main>
  );
}
