import { notFound } from "next/navigation";
import { PortfolioExperience } from "../../../components/PortfolioExperience";
import { portfolioWorldNodeById } from "../../../lib/portfolio-world";
import { shareMetadata } from "../../../lib/portfolio-sharing";

type NodePageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: NodePageProps) {
  const { id } = await params;
  if (!portfolioWorldNodeById.has(id)) notFound();
  return shareMetadata(id);
}

export default async function NodePage({ params }: NodePageProps) {
  const { id } = await params;
  if (!portfolioWorldNodeById.has(id)) notFound();
  return <PortfolioExperience initialNodeId={id} />;
}
