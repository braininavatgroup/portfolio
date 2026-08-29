import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortfolioHeader } from "../../../components/PortfolioHeader";
import {
  legacyProjectSlugRedirects,
  portfolioContact,
  portfolioThreads,
  portfolioWorldNodeById,
  portfolioWorldNodes,
} from "../../../lib/portfolio-world";

type NodePageProps = {
  params: Promise<{ slug: string }>;
};

const contentNodes = portfolioWorldNodes.filter(
  (node) => node.family !== "story",
);

export function generateStaticParams() {
  return contentNodes.map(({ id }) => ({ slug: id }));
}

export async function generateMetadata({
  params,
}: NodePageProps): Promise<Metadata> {
  const { slug } = await params;
  const node = portfolioWorldNodeById.get(slug);
  if (!node || node.family === "story") return {};
  return {
    title: `${node.label} | Bradley Berkman`,
    description: node.summary,
  };
}

export default async function NodePage({ params }: NodePageProps) {
  const { slug } = await params;
  const legacyTarget = legacyProjectSlugRedirects[slug];
  if (legacyTarget) redirect(`/index/${legacyTarget}`);

  const node = portfolioWorldNodeById.get(slug);
  if (!node || node.family === "story") notFound();

  const containingThreads = portfolioThreads.filter(({ members }) =>
    members.includes(node.id),
  );

  return (
    <main className="artifact-page node-page" data-theme="light" id="main-content" tabIndex={-1}>
      <PortfolioHeader />
      <article className="node-article">
        <header>
          <p className="eyebrow">{node.kind}</p>
          <h1>{node.label}</h1>
          <p className="lede">{node.summary}</p>
          {node.principle ? (
            <p className="node-principle">{node.principle}</p>
          ) : null}
        </header>
        <section className="node-body">
          {node.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
        {node.id === "bradley" ? (
          <section className="node-contact">
            <h2>Contact</h2>
            <ul>
              <li>
                <a href={`mailto:${portfolioContact.email}`}>{portfolioContact.email}</a>
              </li>
              <li>
                <a href={portfolioContact.cv.href} download>{portfolioContact.cv.label}</a>
              </li>
              {portfolioContact.socials.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} rel="noreferrer" target="_blank">{label}</a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {node.evidence?.length ? (
          <section className="node-evidence">
            <h2>Evidence</h2>
            <ul>
              {node.evidence.map(({ label, status, note }) => (
                <li key={label}>
                  <strong>{label}</strong>
                  <em>{`Evidence ${status}`}</em>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {containingThreads.length > 0 ? (
          <section className="node-threads">
            <h2>Threads</h2>
            <ul>
              {containingThreads.map((thread) => (
                <li key={thread.id}>
                  <Link href={`/?view=graph#thread/${thread.id}`}>{thread.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <footer className="node-footer">
          <Link href={`/?view=graph#${node.id}`}>View on the map</Link>
          <Link href="/index">← Index</Link>
        </footer>
      </article>
    </main>
  );
}
