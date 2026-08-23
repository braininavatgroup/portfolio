import { artifacts, type ArtifactTokenKind } from "../../lib/portfolio";

const outputTokensByProjectSlug = new Map<string, ArtifactTokenKind>(
  artifacts.map(({ slug, token }) => [slug, token]),
);

export function getOutputToken(projectSlug: string): ArtifactTokenKind | undefined {
  return outputTokensByProjectSlug.get(projectSlug);
}
