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

export default function WorkIndex() {
  return (
    <main className="flat-index" data-theme="light" id="main-content">
      <PortfolioHeader activeView="work" />
      <header className="index-header">
        <h1>Project index</h1>
        <p className="lede">{portfolioThroughline}</p>
      </header>

      {projectGroups.map((group) => (
        <section className="domain-section" id={group.id} key={group.id}>
          <div className="domain-heading">
            <h2>{group.label}</h2>
            {group.description ? <p>{group.description}</p> : null}
          </div>
          <div className="domain-work">
            <ol className="artifact-index-list">
              {group.projects.map((project) => {
                const evidenceStatus = project.facets?.evidenceStatus?.[0];
                return (
                  <li className="artifact-index-entry" key={project.slug}>
                    <Link
                      className="artifact-main-link"
                      href={`/work/${project.slug}`}
                    >
                      <strong>{project.title}</strong>
                      <small>{project.summary}</small>
                      {evidenceStatus ? (
                        <em>{`Evidence ${evidenceStatus}`}</em>
                      ) : null}
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
