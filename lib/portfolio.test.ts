import { describe, expect, it } from "vitest";
import {
  artifactSlugs,
  artifacts,
  careerTimeline,
  getArtifact,
} from "./portfolio";

describe("portfolio content contract", () => {
  it("keeps artifact slugs unique", () => {
    expect(artifactSlugs.every(Boolean)).toBe(true);
    expect(new Set(artifactSlugs).size).toBe(artifactSlugs.length);
  });

  it("keeps every source record complete and addressable", () => {
    for (const artifact of artifacts) {
      expect(artifact.title).not.toBe("");
      expect(artifact.summary).not.toBe("");
      expect(artifact.principle).not.toBe("");
      expect(artifact.decision).not.toBe("");
      expect(artifact.reason).not.toBe("");
      expect(artifact.chain.length).toBeGreaterThan(0);
      expect(artifact.chain.every((entry) => entry.title && entry.detail)).toBe(
        true,
      );
      expect(["available", "partial", "needed"]).toContain(
        artifact.evidenceStatus,
      );
      expect(artifact.evidence.every((item) => item.label && item.note)).toBe(
        true,
      );
      expect(getArtifact(artifact.slug)).toBe(artifact);
    }
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
