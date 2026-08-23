import Link from "next/link";
import { CareerTimeline } from "../../components/CareerTimeline";
import {
  artifacts,
  audienceStatement,
  domains,
  portfolioThroughline,
} from "../../lib/portfolio";

export default function WorkIndex() {
  return (
    <main className="flat-index" data-theme="light" id="main-content">
      <header className="index-header">
        <nav aria-label="Portfolio views">
          <Link href="/?view=graph">Back to the map</Link>
        </nav>
        <p className="eyebrow">Portfolio</p>
        <h1>Selected work</h1>
        <p className="lede">{portfolioThroughline}</p>
        <p>{audienceStatement}</p>
        <div className="index-actions">
          <nav className="domain-jumps" aria-label="Jump to a domain">
            {domains.map((domain) => (
              <a href={`#${domain.id}`} key={domain.id}>{domain.label}</a>
            ))}
          </nav>
        </div>
      </header>

      <CareerTimeline />

      {domains.map((domain, domainIndex) => {
        const domainArtifacts = artifacts.filter(
          (artifact) => artifact.domain === domain.id,
        );
        return (
          <section className="domain-section" id={domain.id} key={domain.id}>
            <div className="domain-heading">
              <p className="eyebrow">{String(domainIndex + 1).padStart(2, "0")}</p>
              <h2>{domain.label}</h2>
              <p>{domain.description}</p>
            </div>
            <div className="domain-work">
              <ol className="artifact-index-list">
                {domainArtifacts.map((artifact, index) => (
                  <li className="artifact-index-entry" key={artifact.slug}>
                    <Link className="artifact-main-link" href={`/work/${artifact.slug}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{artifact.title}</strong>
                      <small>{artifact.summary}</small>
                      <em>Evidence {artifact.evidenceStatus}</em>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        );
      })}
    </main>
  );
}
