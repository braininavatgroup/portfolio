import { describe, expect, it } from "vitest";
import { normalizePortfolioChatTurnstileSiteKey } from "./portfolio-chat-config";

describe("portfolio chat public configuration", () => {
  it("treats an absent or blank Turnstile site key as dormant", () => {
    expect(normalizePortfolioChatTurnstileSiteKey(undefined)).toBeUndefined();
    expect(normalizePortfolioChatTurnstileSiteKey("   ")).toBeUndefined();
  });

  it("trims a configured Turnstile site key", () => {
    expect(normalizePortfolioChatTurnstileSiteKey("  site-key  ")).toBe(
      "site-key",
    );
  });
});
