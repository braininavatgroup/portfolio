import Link from "next/link";
import { PortfolioHeader } from "../../components/PortfolioHeader";
import { PortfolioNodeMark } from "../../components/PortfolioNodeMark";
import {
  portfolioThreads,
  portfolioThroughline,
  portfolioWorldIndexSections,
  portfolioWorldNodeById,
} from "../../lib/portfolio-world";

export default function ProjectIndex() {
  return (
    <main
      className="flat-index stacked-editorial-index"
      data-index-layout="stacked-editorial"
      data-theme="light"
      id="main-content"
      tabIndex={-1}
    >
      <PortfolioHeader activeView="index" />
      <header className="index-header">
        <h1>Index</h1>
        <p className="lede">{portfolioThroughline}</p>
      </header>

      {portfolioWorldIndexSections.map((section) => {
        if (section.type === "threads") {
          return (
            <section className="domain-section" data-project-count={portfolioThreads.length} id={section.id} key={section.id}>
              <div className="domain-heading">
                <div>
                  <h2>{section.title}</h2>
                  <p>Narrated paths through the work.</p>
                </div>
              </div>
              <div className="domain-work">
                <ol className="artifact-index-list">
                  {portfolioThreads.map((thread) => {
                    const node = portfolioWorldNodeById.get(thread.nodeId);
                    if (!node) return null;
                    return (
                    <li className="artifact-index-entry" key={thread.id}>
                      <Link
                        className="artifact-main-link"
                        href={`/?view=graph#thread/${thread.id}`}
                      >
                        <span className="artifact-index-copy">
                          <strong>{thread.title}</strong>
                          <small>{thread.lede}</small>
                        </span>
                        <span className="artifact-index-meta">
                          <PortfolioNodeMark family={node.family} register={node.register} />
                        </span>
                      </Link>
                    </li>
                    );
                  })}
                </ol>
              </div>
            </section>
          );
        }

        return (
          <section
            className="domain-section"
            data-project-count={section.nodeIds.length}
            id={section.id}
            key={section.id}
          >
            <div className="domain-heading">
              <div>
                <h2>{section.title}</h2>
              </div>
            </div>
            <div className="domain-work">
              <ol className="artifact-index-list">
                {section.nodeIds.map((nodeId) => {
                  const node = portfolioWorldNodeById.get(nodeId);
                  if (!node) return null;
                  return (
                    <li className="artifact-index-entry" key={node.id}>
                      <Link
                        className="artifact-main-link"
                        href={`/?view=graph#${node.id}`}
                      >
                        <span className="artifact-index-copy">
                          <strong>{node.label}</strong>
                          <small>{node.summary}</small>
                        </span>
                        <span className="artifact-index-meta">
                          <PortfolioNodeMark family={node.family} register={node.register} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        );
      })}
    </main>
  );
}
