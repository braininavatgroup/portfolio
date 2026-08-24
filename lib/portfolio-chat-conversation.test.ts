import { describe, expect, it } from "vitest";
import {
  appendPortfolioChatTurn,
  boundPortfolioChatConversation,
  parsePortfolioChatConversation,
} from "./portfolio-chat-conversation";

describe("portfolio chat conversation context", () => {
  it("keeps only the newest bounded context", () => {
    const conversation = boundPortfolioChatConversation([
      { role: "user", content: "Old question" },
      { role: "assistant", content: "Old answer" },
      { role: "user", content: "Recent question" },
      { role: "assistant", content: "Recent answer" },
    ]);

    expect(conversation).toHaveLength(4);
    expect(conversation[0]?.content).toBe("Old question");

    const appended = appendPortfolioChatTurn(
      conversation,
      "A follow-up",
      "A grounded follow-up answer. [E1]",
    );
    expect(appended.at(-2)).toEqual({ role: "user", content: "A follow-up" });
    expect(appended.at(-1)).toEqual({
      role: "assistant",
      content: "A grounded follow-up answer. [E1]",
    });
  });

  it("rejects malformed client-provided conversation context", () => {
    expect(parsePortfolioChatConversation({ role: "user" })).toEqual({
      ok: false,
    });
    expect(parsePortfolioChatConversation([{ role: "system", content: "x" }])).toEqual({
      ok: false,
    });
  });
});
