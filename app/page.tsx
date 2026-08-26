import { PortfolioExperience } from "../components/PortfolioExperience";

export function isAvatarLabRequested(
  value: string | undefined,
  environment: string | undefined = process.env.NODE_ENV,
) {
  return environment === "development" && value === "1";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ avatarLab?: string; view?: string }>;
}) {
  const { avatarLab, view } = await searchParams;
  const initialPhase = view === "graph" ? "graph" : "body";
  return (
    <PortfolioExperience
      avatarLab={isAvatarLabRequested(avatarLab)}
      initialPhase={initialPhase}
    />
  );
}
