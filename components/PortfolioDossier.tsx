"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
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
  const { onDragStart, panelRef, style } = useDossierDrag();
  const label = dossier
    ? `${dossier.project.title} project dossier`
    : "Portfolio index";

  return (
    <aside
      aria-label={label}
      className={`portfolio-dossier${dossier ? " portfolio-project-dossier" : ""}`}
      ref={panelRef}
      style={style}
    >
      {dossier ? (
        <ProjectDossier
          dossier={dossier}
          key={`${dossier.project.slug}:${dossier.selectedRole}`}
          onDragStart={onDragStart}
          onShowIndex={onShowIndex}
        />
      ) : (
        <PortfolioIndex
          key={selectedDomain ?? "all-domains"}
          onDomainSelect={onDomainSelect}
          onDragStart={onDragStart}
          selectedDomain={selectedDomain}
        />
      )}
    </aside>
  );
}

type PanelPosition = { x: number; y: number };

function useDossierDrag() {
  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
  } | null>(null);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  useEffect(() => {
    const margin = 12;

    function move(event: PointerEvent) {
      const active = drag.current;
      if (!active || event.pointerId !== active.pointerId) return;
      const maxX = Math.max(margin, window.innerWidth - active.width - margin);
      const maxY = Math.max(margin, window.innerHeight - active.height - margin);
      setPosition({
        x: Math.min(
          Math.max(active.originX + event.clientX - active.startX, margin),
          maxX,
        ),
        y: Math.min(
          Math.max(active.originY + event.clientY - active.startY, margin),
          maxY,
        ),
      });
    }

    function stop(event: PointerEvent) {
      if (drag.current?.pointerId !== event.pointerId) return;
      drag.current = null;
      document.body.style.cursor = "";
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.cursor = "";
    };
  }, []);

  function onDragStart(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || window.innerWidth <= 760) return;
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: bounds.left,
      originY: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    document.body.style.cursor = "grabbing";
  }

  const style: CSSProperties | undefined = position
    ? {
        bottom: "auto",
        left: `${position.x}px`,
        right: "auto",
        top: `${position.y}px`,
        transform: "none",
      }
    : undefined;

  return { onDragStart, panelRef, style };
}

function PortfolioIndex({
  selectedDomain,
  onDomainSelect,
  onDragStart,
}: Pick<PortfolioDossierProps, "selectedDomain" | "onDomainSelect"> & {
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const id = useId();
  const [openDomain, setOpenDomain] = useState<DomainId | null>(
    selectedDomain,
  );

  return (
    <>
      <div
        aria-label="Move portfolio panel"
        className="dossier-header dossier-drag-handle"
        onPointerDown={onDragStart}
      >
        <p className="eyebrow">Portfolio index</p>
        <p>{portfolioThroughline}</p>
      </div>
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
                      <Link href={`/index/${project.slug}`}>
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
        <Link href="/index">Open the full project index</Link>
      </footer>
    </>
  );
}

function ProjectDossier({
  dossier,
  onDragStart,
  onShowIndex,
}: {
  dossier: PortfolioDossierRecord;
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void;
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
    <>
      <button className="dossier-back" onClick={onShowIndex} type="button">
        <span aria-hidden="true">←</span> Portfolio index
      </button>
      <div
        aria-label="Move portfolio panel"
        className="dossier-header dossier-drag-handle"
        onPointerDown={onDragStart}
      >
        {domain ? <p className="eyebrow">{domain.label}</p> : null}
        <h1>{dossier.project.title}</h1>
        <p>{dossier.project.summary}</p>
        {evidenceStatus ? (
          <span className={`evidence-badge evidence-${evidenceStatus}`}>
            Evidence {evidenceStatus}
          </span>
        ) : null}
      </div>
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
        <Link href={`/index/${dossier.project.slug}`}>
          Read the full {dossier.project.title} case study
        </Link>
      </footer>
    </>
  );
}
