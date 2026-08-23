"use client";

import Link from "next/link";
import { lazy, Suspense, useEffect, useReducer, useState } from "react";
import { domains, type DomainId } from "../lib/portfolio";
import {
  transitionDuration,
  transitionReducer,
} from "../lib/transition";
import { TransitionStatus } from "./TransitionStatus";
import { KeyboardNavigator } from "./KeyboardNavigator";
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

export function PortfolioExperience() {
  const [transition, dispatch] = useReducer(transitionReducer, {
    phase: "body",
    run: 0,
  });
  const reducedMotion = useReducedMotion();
  const [selectedDomain, setSelectedDomain] = useState<DomainId | null>(null);
  const [pose, setPose] = useState<PoseState>("idle");

  useEffect(() => {
    if (transition.phase !== "entering") return;
    const timer = window.setTimeout(
      () => dispatch({ type: "COMPLETE" }),
      transitionDuration(reducedMotion),
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, transition.phase, transition.run]);

  return (
    <main className={`experience experience-${transition.phase}`} id="main-content">
      <TransitionStatus phase={transition.phase} />
      <header className="experience-header">
        <Link className="wordmark" href="/">Bradley Berkman</Link>
        <nav aria-label="Portfolio views">
          <Link href="/work">Work</Link>
          {transition.phase === "graph" ? (
            <button type="button" onClick={() => dispatch({ type: "RESET" })}>
              Replay entry
            </button>
          ) : null}
        </nav>
      </header>

      <section className="scene-shell" id="brain" aria-label="Spatial portfolio preview">
        <Suspense
          fallback={
            <div className="scene-loading" role="status">
              Preparing the spatial view. All project pages are available now.
            </div>
          }
        >
          <PortfolioCanvas
            phase={transition.phase}
            pose={pose}
            selectedDomain={selectedDomain}
            reducedMotion={reducedMotion}
            onEnter={() => dispatch({ type: "ENTER" })}
          />
        </Suspense>

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
              Enter the graph
            </button>
          ) : null}
          {transition.phase === "entering" ? (
            <p className="transition-label">Moving through the glass…</p>
          ) : null}
        </div>
        {transition.phase === "graph" ? (
          <aside className="graph-toolbar" aria-label="Guided graph tour">
            <p className="eyebrow">Graph open</p>
            <p>Choose a direction. Radial distance marks distance from judgment.</p>
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
            <Link href="/work">Browse all work</Link>
          </aside>
        ) : null}
        {transition.phase === "graph" ? <KeyboardNavigator /> : null}
        <PortfolioChat onPoseChange={setPose} />
        <FrameSampler />
      </section>
    </main>
  );
}
