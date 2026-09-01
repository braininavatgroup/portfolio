import { describe, expect, it } from "vitest";
import { artifacts } from "../lib/portfolio";
import { getOutputToken } from "../components/scene/output-token-map";

/**
 * output-token-map.ts hardcodes the nine slug → token pairs rather than
 * deriving them from `artifacts`, because importing that module dragged the
 * authored case-study prose and the spatial-graph chain into the client bundle
 * for `/` to produce nine strings. This test is what makes the duplication
 * safe: it runs in Node, imports both, and fails the moment they disagree.
 */
describe("output token map", () => {
  it("matches every artifact's authored token", () => {
    expect(artifacts.length).toBeGreaterThan(0);

    for (const { slug, token } of artifacts) {
      expect(getOutputToken(slug), `${slug} drifted`).toBe(token);
    }
  });

  it("carries no slug the artifacts no longer define", () => {
    const authored = new Set(artifacts.map(({ slug }) => slug));
    const mapped = artifacts
      .map(({ slug }) => slug)
      .filter((slug) => getOutputToken(slug) !== undefined);

    expect(mapped).toHaveLength(authored.size);
  });
});
