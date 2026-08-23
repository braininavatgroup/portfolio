import { careerTimeline } from "../lib/portfolio";

export function CareerTimeline() {
  return (
    <section className="career-timeline" aria-labelledby="timeline-heading">
      <header>
        <p className="eyebrow">Experience</p>
        <h2 id="timeline-heading">Career timeline</h2>
        <p>
          Music promotion branches into consulting, development, and agent systems.
        </p>
      </header>
      <ol>
        {careerTimeline.map((item) => (
          <li key={item.period}>
            <p>{item.period}</p>
            <div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <span className={`evidence-badge evidence-${item.evidenceStatus}`}>
                Evidence {item.evidenceStatus}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
