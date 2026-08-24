import { PortfolioExperience } from "../components/PortfolioExperience";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const initialPhase = view === "graph" ? "graph" : "body";
  return (
    <PortfolioExperience initialPhase={initialPhase} key={initialPhase} />
  );
}
