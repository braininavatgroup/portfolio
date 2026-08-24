import Link from "next/link";
import { CareerTimeline } from "../../components/CareerTimeline";
import { groupProjectsByFacet } from "../../lib/case-study";
import {
  audienceStatement,
  domains,
  portfolioThroughline,
} from "../../lib/portfolio";
import { portfolioData } from "../../lib/portfolio-data";

const projectGroups = groupProjectsByFacet(
  portfolioData.projects,
  "domain",
  domains,
);

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
            {projectGroups.map((group) => (
              <a href={`#${group.id}`} key={group.id}>{group.label}</a>
            ))}
          </nav>
        </div>
      </header>

      <CareerTimeline />

      {projectGroups.map((group, groupIndex) => (
        <section className="domain-section" id={group.id} key={group.id}>
          <div className="domain-heading">
            <p className="eyebrow">{String(groupIndex + 1).padStart(2, "0")}</p>
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
