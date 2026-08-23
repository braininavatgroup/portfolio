import { PortfolioExperience } from "../components/PortfolioExperience";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return <PortfolioExperience initialPhase={view === "graph" ? "graph" : "body"} />;
}
