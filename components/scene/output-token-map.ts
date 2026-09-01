import type { ArtifactTokenKind } from "../../lib/portfolio";

/**
 * The nine slug → token pairs, as data.
 *
 * This used to derive the map from `artifacts` in lib/portfolio.ts, which meant
 * importing that module — and with it ~6.5 KB of authored case-study prose plus
 * the spatial-graph/model chain it pulls behind it — into the client bundle for
 * `/`, to produce nine strings. None of that prose renders on any live route.
 * `tests/portfolio-output-tokens.test.ts` asserts this stays in step with
 * `artifacts`, so the duplication cannot drift.
 */
const outputTokensByProjectSlug: Readonly<Record<string, ArtifactTokenKind>> = {
  "kickoff-intake": "intake",
  pitching: "selection",
  reporting: "report",
  "real-estate-deal-tracker": "tracker",
  "touring-advancing-tool": "road-case",
  dubs: "audio",
  "three-maturity-bundle": "maturity",
  "personal-tooling": "toolkit",
  "spec-discipline": "spec",
};

export function getOutputToken(projectSlug: string): ArtifactTokenKind | undefined {
  return outputTokensByProjectSlug[projectSlug];
}
