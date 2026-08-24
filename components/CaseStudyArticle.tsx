import type { CaseStudy, CaseStudyItem } from "../lib/case-study";

// Framing labels for the roles of the current projection shape, not entity kinds.
const roleLabels: Record<string, string> = {
  instinct: "Instinct",
  approach: "Approach",
  output: "Output",
};

const roleLabel = (role: string) => roleLabels[role] ?? role.replaceAll("-", " ");

export function CaseStudyArticle({ caseStudy }: { caseStudy: CaseStudy }) {
  const { project, steps } = caseStudy;
  const canonicalHref = `/work/${project.slug}`;
  const domain = project.facets?.domain?.[0];
  const evidenceStatus = project.facets?.evidenceStatus?.[0];

  return (
    <article className="chain-article">
      <header className="chain-header">
        {domain ? <p className="eyebrow">{domain}</p> : null}
        <h1>{project.title}</h1>
        <p className="lede">{project.summary}</p>
        {evidenceStatus ? (
          <span className={`evidence-badge evidence-${evidenceStatus}`}>
            {`Evidence ${evidenceStatus}`}
          </span>
        ) : null}
      </header>

      <ol className="chain-list" aria-label="Case study steps">
        {steps.map((step, index) => (
          <li className="chain-step" id={`step-${step.role}`} key={step.role}>
            <div className="chain-marker" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div>
              <p className="chain-layer">{roleLabel(step.role)}</p>
              <h2>{step.title}</h2>
              <p>{step.summary}</p>
              <ul className="step-entities" aria-label={`${roleLabel(step.role)} details`}>
                {step.items.map((item) => (
                  <StepEntity
                    canonicalHref={canonicalHref}
                    item={item}
                    key={item.entity.id}
                  />
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

function StepEntity({
  item,
  canonicalHref,
}: {
  item: CaseStudyItem;
  canonicalHref: string;
}) {
  const links =
    item.entity.links?.filter(({ href }) => href !== canonicalHref) ?? [];

  return (
    <li className="step-entity">
      <h3>{item.entity.title}</h3>
      {item.evidenceStatus ? (
        <p className="entity-status">
          <span
            aria-hidden="true"
            className={`evidence-dot evidence-${item.evidenceStatus}`}
          />
          {`Evidence ${item.evidenceStatus}`}
        </p>
      ) : null}
      <p>{item.entity.summary}</p>
      {item.entity.detail ? <p>{item.entity.detail}</p> : null}
      {links.map((link) => (
        <a href={link.href} key={`${link.label}:${link.href}`}>
          {link.label}
        </a>
      ))}
      {item.leads.map((lead) => (
        <p className="entity-relation" key={`${lead.label}:${lead.to.id}`}>
          {lead.label} <span aria-hidden="true">→</span> {lead.to.title}
        </p>
      ))}
      {item.support.length > 0 ? (
        <ul
          aria-label={`Supporting material for ${item.entity.title}`}
          className="entity-evidence"
        >
          {item.support.map((support) => (
            <li key={support.entity.id}>
              <span
                aria-hidden="true"
                className={`evidence-dot evidence-${support.status}`}
              />
              <div>
                <strong>{support.entity.title}</strong>
                <p>{support.entity.summary}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
