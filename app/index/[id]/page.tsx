import { notFound, redirect } from "next/navigation";
import { portfolioWorldNodeById } from "../../../lib/portfolio-world";

// The map reader is the only reading surface. Canonical record URLs land on
// the map with that record open.
type NodePageProps = {
  params: Promise<{ id: string }>;
};

export default async function NodePage({ params }: NodePageProps) {
  const { id } = await params;
  const node = portfolioWorldNodeById.get(id);
  if (!node || node.outlineType === "why") notFound();
  redirect(`/?view=graph#${id}`);
}
