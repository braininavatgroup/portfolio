import { describe, expect, it } from "vitest";
import {
  artifactSlugs,
  artifacts,
  careerTimeline,
  getArtifact,
  portfolioNodes,
} from "./portfolio";

const expectedSlugs = [
  "kickoff-intake",
  "pitching",
  "reporting",
  "real-estate-deal-tracker",
  "touring-advancing-tool",
  "dubs",
  "three-maturity-bundle",
  "personal-tooling",
  "spec-discipline",
];

const expectedLayers = [
  "judgment",
  "spec",
  "system",
  "artifact",
  "operation",
];

describe("portfolio content contract", () => {
  it("keeps the canonical artifact set stable and unique", () => {
    expect(artifactSlugs).toEqual(expectedSlugs);
    expect(new Set(artifactSlugs).size).toBe(artifactSlugs.length);
  });

  it("gives every artifact one complete ordered chain", () => {
    for (const artifact of artifacts) {
      expect(artifact.chain.map((entry) => entry.layer)).toEqual(expectedLayers);
      expect(["available", "partial", "needed"]).toContain(
        artifact.evidenceStatus,
      );
      expect(getArtifact(artifact.slug)).toBe(artifact);
    }
  });

  it("gives every artifact a fixed graph node", () => {
    for (const artifact of artifacts) {
      const node = portfolioNodes.find(
        (candidate) =>
          candidate.kind === "artifact" && candidate.slug === artifact.slug,
      );
      expect(node).toBeDefined();
      expect(node?.position).toHaveLength(3);
      expect(node?.href).toBe(`/work/${artifact.slug}`);
    }
  });

  it("ends every graph chain at its artifact", () => {
    for (const artifact of artifacts) {
      const graphNodes = portfolioNodes.filter(
        (candidate) => candidate.slug === artifact.slug,
      );
      expect(graphNodes.map((node) => node.kind)).toEqual([
        "spec",
        "system",
        "artifact",
      ]);

      const artifactNode = graphNodes.at(-1);
      expect(artifactNode?.kind).toBe("artifact");
      expect(
        portfolioNodes.some((node) => node.parentId === artifactNode?.id),
      ).toBe(false);
      expect(artifact.chain.at(-1)?.layer).toBe("operation");
    }
  });

  it("assigns every artifact a distinct visual token", () => {
    const tokens = portfolioNodes
      .filter((node) => node.kind === "artifact")
      .map((node) => (node as typeof node & { token?: string }).token);

    expect(tokens.every(Boolean)).toBe(true);
    expect(new Set(tokens).size).toBe(artifacts.length);
  });

  it("keeps the evidence-backed career sequence linear", () => {
    expect(careerTimeline.map((item) => item.period)).toEqual([
      "Origin / 2016",
      "2021–2024",
      "After 2024",
      "Current",
    ]);
    expect(careerTimeline.at(-1)?.evidenceStatus).toBe("needed");
  });
});
