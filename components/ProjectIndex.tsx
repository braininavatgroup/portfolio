import Link from "next/link";
import {
  getBranch,
  mainProjection,
  portfolioData,
} from "../lib/portfolio-data";
import type { ProjectRecord, TripletRole } from "../lib/portfolio-model";

const roleLabels: Record<TripletRole, string> = {
  instinct: "Instinct",
  approach: "Approach",
  output: "Output",
};

function humanizeFacet(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function evidenceLabel(project: ProjectRecord) {
  const state = project.facets?.evidenceStatus?.[0];
  if (!state) return "Evidence state not published";
  if (state === "available") return "Evidence available";
  if (state === "needed") return "Evidence needed";
  return `${humanizeFacet(state)} evidence`;
}

function evidenceClass(project: ProjectRecord) {
  const state = project.facets?.evidenceStatus?.[0];
  return state ? ` evidence-${state.replace(/[^a-z0-9-]/gi, "-")}` : "";
}

export function ProjectIndex({
  projects = portfolioData.projects,
}: {
  projects?: readonly ProjectRecord[];
}) {
  return (
    <main className="flat-index project-index" data-theme="light" id="main-content">
      <header className="index-header project-index-header">
        <nav className="portfolio-view-nav" aria-label="Portfolio views">
          <Link href="/?view=graph">Portfolio map</Link>
          <span aria-current="page">Project index</span>
        </nav>
        <p className="eyebrow">
          Portfolio · {projects.length} {projects.length === 1 ? "project" : "projects"}
        </p>
        <h1>Project index</h1>
        <p className="lede">
          A direct route through the work: the judgment behind each project,
          the approach it shaped, and the output it produced.
        </p>
      </header>

      <section className="project-directory" aria-label="Portfolio projects">
        <header className="project-directory-heading">
          <p className="eyebrow">Browse the work</p>
          <h2>From instinct to output.</h2>
          <p>
            Each project opens its canonical case study. Evidence labels reflect
            what is currently published.
          </p>
        </header>

        {projects.length === 0 ? (
          <p className="project-index-empty" role="status">
            No portfolio projects are published in this view yet.
          </p>
        ) : (
          <ol className="project-card-grid">
            {projects.map((project, index) => {
              const branch = getBranch(project.id, mainProjection.id);
              const domains = project.facets?.domain ?? [];

              return (
                <li className="project-card" key={project.id}>
                  <Link
                    aria-label={`View ${project.title} case study`}
                    className="project-card-link"
                    href={`/work/${project.slug}`}
                  >
                    <span className="project-card-number" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {domains.length > 0 ? (
                      <span
                        aria-label={`Domains: ${domains.map(humanizeFacet).join(", ")}`}
                        className="project-card-facets"
                      >
                        {domains.map((domain) => (
                          <span key={domain}>{humanizeFacet(domain)}</span>
                        ))}
                      </span>
                    ) : null}
                    <strong>{project.title}</strong>
                    <small>{project.summary}</small>

                    {branch ? (
                      <span className="project-card-stages" aria-label="Project stages">
                        {branch.steps.map((step) => (
                          <span className="project-card-stage" key={step.role}>
                            <span>{roleLabels[step.role]}</span>
                            <b>{step.title}</b>
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="project-card-unavailable">
                        Stage details not published
                      </span>
                    )}

                    <span className="project-card-footer">
                      <em className={`project-evidence${evidenceClass(project)}`}>
                        {evidenceLabel(project)}
                      </em>
                      <span className="project-card-cta">
                        View case study <span aria-hidden="true">↗</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
