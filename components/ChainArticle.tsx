import type { ArtifactRecord, ChainLayer } from "../lib/portfolio";
import { ArtifactSurface } from "./ArtifactSurface";

const layerLabels: Record<ChainLayer, string> = {
  judgment: "Judgment",
  spec: "Spec or model",
  system: "System",
  artifact: "Artifact",
  operation: "Other minds",
};

const statusLabels = {
  available: "Evidence available",
  partial: "Evidence partial",
  needed: "Evidence needed",
} as const;

export function ChainArticle({ artifact }: { artifact: ArtifactRecord }) {
  return (
    <article className="chain-article">
      <header className="chain-header">
        <p className="eyebrow">{artifact.domain}</p>
        <h1>{artifact.title}</h1>
        <p className="lede">{artifact.summary}</p>
        <span className={`evidence-badge evidence-${artifact.evidenceStatus}`}>
          {statusLabels[artifact.evidenceStatus]}
        </span>
      </header>

      <ArtifactSurface artifact={artifact} />

      <ol className="chain-list" aria-label="Complete argument chain">
        {artifact.chain.map((entry, index) => (
          <li key={entry.layer} className="chain-step" id={entry.layer}>
            <div className="chain-marker" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div>
              <p className="chain-layer">{layerLabels[entry.layer]}</p>
              <h2>{entry.title}</h2>
              <p>{entry.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="decision-panel" aria-labelledby="decision-heading">
        <p className="eyebrow" id="decision-heading">Decision</p>
        <h2>{artifact.decision}</h2>
        <p>{artifact.reason}</p>
      </section>

      <section className="evidence-panel" aria-labelledby="evidence-heading">
        <p className="eyebrow" id="evidence-heading">Case material</p>
        <h2>Supporting evidence</h2>
        <ul>
          {artifact.evidence.map((item) => (
            <li key={item.label}>
              <span className={`evidence-dot evidence-${item.status}`} aria-hidden="true" />
              <div>
                <strong>{item.label}</strong>
                <p>{item.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
