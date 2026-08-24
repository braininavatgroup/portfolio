import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseStudyArticle } from "../../../components/CaseStudyArticle";
import {
  caseStudySlugs,
  getAdjacentProjects,
  getCaseStudy,
} from "../../../lib/case-study";

type CaseStudyPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return caseStudySlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: CaseStudyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const caseStudy = getCaseStudy(slug);
  if (!caseStudy) return {};
  return {
    title: `${caseStudy.project.title} | Bradley Berkman`,
    description: caseStudy.project.summary,
  };
}

export default async function CaseStudyPage({ params }: CaseStudyPageProps) {
  const { slug } = await params;
  const caseStudy = getCaseStudy(slug);
  if (!caseStudy) notFound();

  const adjacent = getAdjacentProjects(caseStudy.project.slug);

  return (
    <main className="artifact-page" data-theme="light" id="main-content">
      <nav className="artifact-nav" aria-label="Case study navigation">
        <Link href="/?view=graph">Map</Link>
        <Link href="/work">All work</Link>
      </nav>
      <CaseStudyArticle caseStudy={caseStudy} />
      {adjacent ? (
        <nav className="adjacent-nav" aria-label="Adjacent case studies">
          <Link href={`/work/${adjacent.previous.slug}`}>
            <span>Previous</span>
            {adjacent.previous.title}
          </Link>
          <Link href={`/work/${adjacent.next.slug}`}>
            <span>Next</span>
            {adjacent.next.title}
          </Link>
        </nav>
      ) : null}
    </main>
  );
}
