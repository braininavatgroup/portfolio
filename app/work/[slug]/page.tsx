import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChainArticle } from "../../../components/ChainArticle";
import { artifactSlugs, artifacts, getArtifact } from "../../../lib/portfolio";

type ArtifactPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return artifactSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ArtifactPageProps): Promise<Metadata> {
  const { slug } = await params;
  const artifact = getArtifact(slug);
  if (!artifact) return {};
  return {
    title: `${artifact.title} | Bradley Berkman`,
    description: artifact.summary,
  };
}

export default async function ArtifactPage({ params }: ArtifactPageProps) {
  const { slug } = await params;
  const artifact = getArtifact(slug);
  if (!artifact) notFound();

  const currentIndex = artifacts.findIndex((item) => item.slug === artifact.slug);
  const previous = artifacts[(currentIndex - 1 + artifacts.length) % artifacts.length];
  const next = artifacts[(currentIndex + 1) % artifacts.length];

  return (
    <main className="artifact-page" data-theme="light" id="main-content">
      <nav className="artifact-nav" aria-label="Artifact navigation">
        <Link href="/?view=graph">Map</Link>
        <Link href="/work">All work</Link>
      </nav>
      <ChainArticle artifact={artifact} />
      <nav className="adjacent-nav" aria-label="Adjacent artifacts">
        <Link href={`/work/${previous.slug}`}>
          <span>Previous</span>
          {previous.title}
        </Link>
        <Link href={`/work/${next.slug}`}>
          <span>Next</span>
          {next.title}
        </Link>
      </nav>
    </main>
  );
}
