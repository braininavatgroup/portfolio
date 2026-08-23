"use client";

import { useState } from "react";
import type { ArtifactRecord } from "../lib/portfolio";

const stageLabels = {
  spec: "Spec",
  system: "System",
  artifact: "Artifact",
  operation: "Other minds",
} as const;

export function ArtifactSurface({ artifact }: { artifact: ArtifactRecord }) {
  const stages = artifact.chain.filter(
    (
      entry,
    ): entry is (typeof artifact.chain)[number] & {
      layer: keyof typeof stageLabels;
    } => entry.layer !== "judgment",
  );
  const [activeLayer, setActiveLayer] = useState("artifact");
  const active = stages.find((entry) => entry.layer === activeLayer) ?? stages[0];
  const comparison =
    artifact.slug === "real-estate-deal-tracker" ||
    artifact.slug === "touring-advancing-tool";

  return (
    <section className="artifact-surface" aria-labelledby="surface-heading">
      <div className="surface-heading-row">
        <div>
          <p className="eyebrow">System view</p>
          <h2 id="surface-heading">How the work fits together</h2>
        </div>
        <span className={`evidence-badge evidence-${artifact.evidenceStatus}`}>
          Case material {artifact.evidenceStatus}
        </span>
      </div>
      <div className="surface-stage-controls" aria-label="Inspect a chain layer">
        {stages.map((entry, index) => (
          <button
            aria-pressed={active.layer === entry.layer}
            key={entry.layer}
            type="button"
            onClick={() => setActiveLayer(entry.layer)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {stageLabels[entry.layer]}
          </button>
        ))}
      </div>
      <div className="surface-output" aria-live="polite">
        <p className="eyebrow">{stageLabels[active.layer]}</p>
        <h3>{active.title}</h3>
        <p>{active.detail}</p>
      </div>
      {comparison ? (
        <div className="comparison-slots" aria-label="Before and after evidence slots">
          <div>
            <p>Before</p>
            <span>Baseline material pending</span>
          </div>
          <div>
            <p>After</p>
            <span>Outcome material pending</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
