import { describe, expect, it } from "vitest";
import { getLocalWorkerConfig } from "./local-chat-config";

describe("local portfolio chat Worker config", () => {
  it("enables the bounded model-backed chat only for the development server", () => {
    const config = getLocalWorkerConfig("serve");

    expect(config.vars).toEqual({
      OPENAI_PORTFOLIO_MODEL: "gpt-5.6-terra",
      OPENAI_PORTFOLIO_REASONING_EFFORT: "medium",
      PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "200",
      PORTFOLIO_CHAT_LIVE_ENABLED: "true",
      PORTFOLIO_CHAT_TURNSTILE_REQUIRED: "false",
    });
    expect(config.secrets).toEqual({ required: ["OPENAI_API_KEY"] });
    expect(config.durable_objects).toEqual({
      bindings: [
        {
          class_name: "PortfolioChatBudgetObject",
          name: "PORTFOLIO_CHAT_BUDGET",
        },
      ],
    });
    expect(config.migrations).toEqual([
      {
        new_sqlite_classes: ["PortfolioChatBudgetObject"],
        tag: "v1",
      },
    ]);
  });

  it("keeps model credentials and live chat out of production builds", () => {
    const config = getLocalWorkerConfig("build");

    expect(config.vars).toBeUndefined();
    expect(config.secrets).toBeUndefined();
    expect(config.durable_objects).toBeUndefined();
    expect(config.migrations).toBeUndefined();
    expect(JSON.stringify(config)).not.toContain("OPENAI_API_KEY");
    expect(JSON.stringify(config)).not.toContain(
      "PORTFOLIO_CHAT_LIVE_ENABLED",
    );
  });
});
