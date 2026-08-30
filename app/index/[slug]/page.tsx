import { notFound, redirect } from "next/navigation";
import {
  legacyProjectSlugRedirects,
  portfolioWorldNodeById,
} from "../../../lib/portfolio-world";

// The standalone per-record pages were retired (2026-08-30): the map reader
// is the only reading surface. Old links land on the map with the record open.
type NodePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function NodePage({ params }: NodePageProps) {
  const { slug } = await params;
  const nodeId = legacyProjectSlugRedirects[slug] ?? slug;
  const node = portfolioWorldNodeById.get(nodeId);
  if (!node || node.family === "story") notFound();
  redirect(`/?view=graph#${nodeId}`);
}
