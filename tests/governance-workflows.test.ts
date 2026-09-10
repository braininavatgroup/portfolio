import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const canonicalWorkflowRepository =
  "braininavatgroup/brain-in-a-vat-group/.github/workflows";

const callers = [
  {
    path: "linear-link.yml",
    workflow: "linear-link-reusable.yml",
  },
  {
    path: "review-state.yml",
    workflow: "review-state-reusable.yml",
  },
];

describe("governance workflow callers", () => {
  for (const caller of callers) {
    it(`${caller.path} calls the canonical reusable workflow repository`, async () => {
      const source = await readFile(
        new URL(`../.github/workflows/${caller.path}`, import.meta.url),
        "utf8",
      );

      expect(source).toContain(
        `uses: ${canonicalWorkflowRepository}/${caller.workflow}@main`,
      );
    });
  }
});
