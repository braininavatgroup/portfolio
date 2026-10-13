import { expect, it } from "vitest";

import { checkPrivateAssignments } from "./portfolio-insights-private-check.mjs";

it("reports only counts and hides private codes on a configuration failure", async () => {
  expect(await checkPrivateAssignments(async () => [{ person: { name: "Private Person" } }, { person: null }], 2))
    .toBe("Private assignment read passed: 2 assignments, 1 named");
  await expect(checkPrivateAssignments(async () => {
    throw new Error("duplicate campaign code: private-code-123");
  }, 2)).rejects.toThrow("Private assignment read failed; inspect the scoped source configuration");
  await expect(checkPrivateAssignments(async () => {
    throw new Error("duplicate campaign code: private-code-123");
  }, 2)).rejects.not.toThrow("private-code-123");
});
