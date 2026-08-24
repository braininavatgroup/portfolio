"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { groupProjectsByFacet } from "../lib/case-study";
import { domains, portfolioThroughline, type DomainId } from "../lib/portfolio";
import { portfolioData } from "../lib/portfolio-data";
import type { PortfolioDossierRecord } from "../lib/portfolio-dossier";
import type { TripletRole } from "../lib/portfolio-model";

type PortfolioDossierProps = {
  dossier: PortfolioDossierRecord | undefined;
  selectedDomain: DomainId | null;
  onDomainSelect: (domain: DomainId | null) => void;
  onShowIndex: () => void;
};

const projectGroups = groupProjectsByFacet(
  portfolioData.projects,
  "domain",
  domains,
);

const roleLabels: Record<TripletRole, string> = {
  instinct: "Instinct",
  approach: "Approach",
  output: "Output",
};

export function PortfolioDossier({
  dossier,
  selectedDomain,
  onDomainSelect,
  onShowIndex,
}: PortfolioDossierProps) {
  if (dossier) {
    return <ProjectDossier dossier={dossier} onShowIndex={onShowIndex} />;
  }

  return (
    <PortfolioIndex
      onDomainSelect={onDomainSelect}
      selectedDomain={selectedDomain}
    />
  );
}

function PortfolioIndex({
  selectedDomain,
  onDomainSelect,
}: Pick<PortfolioDossierProps, "selectedDomain" | "onDomainSelect">) {
  const id = useId();
  const [openDomain, setOpenDomain] = useState<DomainId | null>(
    selectedDomain ?? "music",
  );

  return (
    <aside aria-label="Portfolio index" className="portfolio-dossier">
      <header className="dossier-header">
        <p className="eyebrow">Portfolio index</p>
        <p>{portfolioThroughline}</p>
      </header>
      <div className="dossier-scroll">
        {projectGroups.map((group) => {
          const expanded = openDomain === group.id;
          const contentId = `${id}-${group.id}`;
          return (
            <section className="dossier-section" key={group.id}>
              <button
                aria-controls={contentId}
                aria-expanded={expanded}
                className="dossier-section-toggle"
                onClick={() => {
                  const next = expanded ? null : (group.id as DomainId);
                  setOpenDomain(next);
                  onDomainSelect(next);
                }}
                type="button"
              >
                <span>{group.label}</span>
                <span aria-hidden="true">{expanded ? "−" : "+"}</span>
              </button>
              <div className="dossier-section-content" hidden={!expanded} id={contentId}>
                {group.description ? <p>{group.description}</p> : null}
                <ol className="dossier-project-list">
                  {group.projects.map((project) => (
                    <li key={project.slug}>
                      <Link href={`/work/${project.slug}`}>
                        <strong>{project.title}</strong>
                        <span>{project.summary}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          );
        })}
      </div>
      <footer className="dossier-footer">
        <Link href="/work">Open the full project index</Link>
      </footer>
    </aside>
  );
}

function ProjectDossier({
  dossier,
  onShowIndex,
}: {
  dossier: PortfolioDossierRecord;
  onShowIndex: () => void;
}) {
  const id = useId();
  const [openRole, setOpenRole] = useState<TripletRole | null>(
    dossier.selectedRole,
  );
  const domainId = dossier.project.facets?.domain?.[0];
  const domain = domains.find(({ id: candidate }) => candidate === domainId);
  const evidenceStatus = dossier.project.facets?.evidenceStatus?.[0];

  return (
    <aside
      aria-label={`${dossier.project.title} project dossier`}
      className="portfolio-dossier portfolio-project-dossier"
    >
      <button className="dossier-back" onClick={onShowIndex} type="button">
        <span aria-hidden="true">←</span> Portfolio index
      </button>
      <header className="dossier-header">
        {domain ? <p className="eyebrow">{domain.label}</p> : null}
        <h1>{dossier.project.title}</h1>
        <p>{dossier.project.summary}</p>
        {evidenceStatus ? (
          <span className={`evidence-badge evidence-${evidenceStatus}`}>
            Evidence {evidenceStatus}
          </span>
        ) : null}
      </header>
      <div className="dossier-scroll">
        {dossier.steps.map((step) => {
          const role = step.role as TripletRole;
          const expanded = openRole === role;
          const contentId = `${id}-${role}`;
          return (
            <section className="dossier-section" key={role}>
              <button
                aria-controls={contentId}
                aria-expanded={expanded}
                className="dossier-section-toggle"
                onClick={() => setOpenRole(expanded ? null : role)}
                type="button"
              >
                <span>{roleLabels[role]}</span>
                <span aria-hidden="true">{expanded ? "−" : "+"}</span>
              </button>
              <div className="dossier-section-content" hidden={!expanded} id={contentId}>
                <h2>{step.title}</h2>
                <p>{step.summary}</p>
                <ul className="dossier-entity-list">
                  {step.items.map((item) => (
                    <li key={item.entity.id}>
                      <h3>{item.entity.title}</h3>
                      {item.entity.summary ? <p>{item.entity.summary}</p> : null}
                      {item.entity.detail ? <p>{item.entity.detail}</p> : null}
                      {item.support.map((support) => (
                        <div className="dossier-evidence" key={support.entity.id}>
                          <span
                            aria-hidden="true"
                            className={`evidence-dot evidence-${support.status}`}
                          />
                          <div>
                            <strong>{support.entity.title}</strong>
                            <p>{support.entity.summary}</p>
                          </div>
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
      <footer className="dossier-footer">
        <Link href={`/work/${dossier.project.slug}`}>
          Read the full {dossier.project.title} case study
        </Link>
      </footer>
    </aside>
  );
}
