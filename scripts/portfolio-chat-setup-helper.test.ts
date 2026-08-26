import { describe, expect, it, vi } from "vitest";
import {
  DEVELOPMENT_KEYCHAIN_ACCOUNT,
  DEVELOPMENT_KEYCHAIN_SERVICE,
} from "./portfolio-chat-environment.mjs";
import {
  configureDevelopmentKey,
  replaceDevelopmentKeyInKeychain,
  storeDevelopmentKeyInKeychain,
  validateProvidedOpenAIKey,
  verifyDevelopmentKeyInKeychain,
} from "./portfolio-chat-setup-helper.mjs";

describe("portfolio chat setup helper", () => {
  it("passes a full-length project key over stdin, never as a process argument", async () => {
    const projectKey = `sk-proj-${"x".repeat(180)}`;
    const runWithInput = vi.fn(
      async (command: string, args: string[], input: string) => {
        void command;
        void args;
        void input;
      },
    );

    await storeDevelopmentKeyInKeychain(projectKey, { runWithInput });

    expect(runWithInput).toHaveBeenCalledOnce();
    const [command, args, input] = runWithInput.mock.calls[0];
    expect(command).toBe("/usr/bin/xcrun");
    expect(args).toEqual([
      "swift",
      "-suppress-warnings",
      expect.stringMatching(/store-keychain-secret\.swift$/),
      DEVELOPMENT_KEYCHAIN_SERVICE,
      DEVELOPMENT_KEYCHAIN_ACCOUNT,
      "Brain in a Vat portfolio development OpenAI key",
    ]);
    expect(args).not.toContain(projectKey);
    expect(input).toBe(projectKey);
    expect(input).toHaveLength(188);
  });

  it("validates the pasted key without exposing surrounding terminal whitespace", async () => {
    const validate = vi.fn(async () => {});

    await validateProvidedOpenAIKey("  sk-proj-complete\n", { validate });

    expect(validate).toHaveBeenCalledWith("sk-proj-complete");
  });

  it("rejects an empty paste before touching a provider or keychain", async () => {
    const validate = vi.fn(async () => {});

    await expect(
      validateProvidedOpenAIKey(" \n", { validate }),
    ).rejects.toThrow("No OpenAI key was provided");
    expect(validate).not.toHaveBeenCalled();
  });

  it("does not replace a working Keychain value when authentication fails", async () => {
    const validate = vi.fn(async () => {
      throw new Error("OpenAI rejected the key (HTTP 401).");
    });
    const replace = vi.fn(async () => {});

    await expect(
      configureDevelopmentKey("sk-proj-invalid", { validate, replace }),
    ).rejects.toThrow("HTTP 401");
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects a Keychain value that differs from the full pasted key", async () => {
    const projectKey = `sk-proj-${"x".repeat(180)}`;

    await expect(
      verifyDevelopmentKeyInKeychain(projectKey, {
        readKeychain: async () => `${projectKey.slice(0, 128)}\n`,
      }),
    ).rejects.toThrow("did not preserve the complete OpenAI key");
  });

  it("restores the previous Keychain value if replacement fails", async () => {
    const actions: string[] = [];
    const previousKey = "sk-proj-previous";
    const replacementKey = `sk-proj-${"x".repeat(180)}`;

    await expect(
      replaceDevelopmentKeyInKeychain(replacementKey, {
        readKeychain: async () => `${previousKey}\n`,
        remove: async () => {
          actions.push("remove");
        },
        store: async (key: string) => {
          actions.push(`store:${key}`);
        },
        verify: async (key: string) => {
          actions.push(`verify:${key}`);
          if (key === replacementKey) throw new Error("truncated");
        },
      }),
    ).rejects.toThrow("truncated");

    expect(actions).toEqual([
      "remove",
      `store:${replacementKey}`,
      `verify:${replacementKey}`,
      "remove",
      `store:${previousKey}`,
      `verify:${previousKey}`,
    ]);
  });
});
