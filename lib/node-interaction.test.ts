import { describe, expect, it } from "vitest";
import type { PortfolioNode } from "./portfolio";
import { nodeAction } from "./node-interaction";

const node = (kind: PortfolioNode["kind"]): PortfolioNode => ({
  id: kind,
  label: kind,
  domain: kind === "brain" ? "center" : "music",
  kind,
  position: [0, 0, 0],
  href: kind === "brain" ? undefined : `/work/example#${kind}`,
  detail: `${kind} detail`,
});

describe("graph node interaction", () => {
  it("keeps the center brain visual rather than presenting a dead control", () => {
    expect(nodeAction(node("brain"))).toBe("none");
  });

  it.each(["spec", "system", "operation"] as const)(
    "opens %s nodes in the map detail panel",
    (kind) => {
      expect(nodeAction(node(kind))).toBe("inspect");
    },
  );

  it("opens artifact nodes as case studies", () => {
    expect(nodeAction(node("artifact"))).toBe("navigate");
  });
});
