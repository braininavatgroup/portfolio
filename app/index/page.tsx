import Link from "next/link";
import { PortfolioHeader } from "../../components/PortfolioHeader";
import { groupProjectsByFacet } from "../../lib/case-study";
import { domains, portfolioThroughline } from "../../lib/portfolio";
import { portfolioData } from "../../lib/portfolio-data";

const projectGroups = groupProjectsByFacet(
  portfolioData.projects,
  "domain",
  domains,
);

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
        <h1>Project index</h1>
        <p className="lede">{portfolioThroughline}</p>
      </header>

      {projectGroups.map((group) => (
        <section
          className="domain-section"
          data-project-count={group.projects.length}
          id={group.id}
          key={group.id}
        >
          <div className="domain-heading">
            <div>
              <h2>{group.label}</h2>
              {group.description ? <p>{group.description}</p> : null}
            </div>
          </div>
          <div className="domain-work">
            <ol className="artifact-index-list">
              {group.projects.map((project) => {
                const evidenceStatus = project.facets?.evidenceStatus?.[0];
                return (
                  <li className="artifact-index-entry" key={project.slug}>
                    <Link
                      className="artifact-main-link"
                      href={`/index/${project.slug}`}
                    >
                      <span className="artifact-index-copy">
                        <strong>{project.title}</strong>
                        <small>{project.summary}</small>
                      </span>
                      <span className="artifact-index-meta">
                        {evidenceStatus ? (
                          <em>{`Evidence ${evidenceStatus}`}</em>
                        ) : null}
                        <span aria-hidden="true">↗</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      ))}
    </main>
  );
}
