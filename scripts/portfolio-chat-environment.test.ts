import { describe, expect, it, vi } from "vitest";
import {
  DEVELOPMENT_KEYCHAIN_ACCOUNT,
  DEVELOPMENT_KEYCHAIN_SERVICE,
  resolveDevelopmentOpenAIKey,
  validateOpenAIKey,
} from "./portfolio-chat-environment.mjs";

describe("portfolio chat development environment", () => {
  it("uses an explicit process key without consulting Keychain", async () => {
    const readKeychain = vi.fn();

    await expect(
      resolveDevelopmentOpenAIKey({
        environment: { OPENAI_API_KEY: "sk-explicit" },
        platform: "darwin",
        readKeychain,
      }),
    ).resolves.toBe("sk-explicit");
    expect(readKeychain).not.toHaveBeenCalled();
  });

  it("loads the shared development key from macOS Keychain", async () => {
    const readKeychain = vi.fn(async () => "sk-keychain\n");

    await expect(
      resolveDevelopmentOpenAIKey({
        environment: {},
        platform: "darwin",
        readKeychain,
      }),
    ).resolves.toBe("sk-keychain");
    expect(readKeychain).toHaveBeenCalledWith({
      account: DEVELOPMENT_KEYCHAIN_ACCOUNT,
      service: DEVELOPMENT_KEYCHAIN_SERVICE,
    });
  });

  it("fails with the one setup command when no development key exists", async () => {
    await expect(
      resolveDevelopmentOpenAIKey({
        environment: {},
        platform: "darwin",
        readKeychain: async () => {
          throw new Error("item not found");
        },
      }),
    ).rejects.toThrow(/npm run setup:chat/);
  });

  it("requires a process key away from macOS", async () => {
    const readKeychain = vi.fn();

    await expect(
      resolveDevelopmentOpenAIKey({
        environment: {},
        platform: "linux",
        readKeychain,
      }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
    expect(readKeychain).not.toHaveBeenCalled();
  });

  it("validates authentication without exposing the key", async () => {
    const cancel = vi.fn(async () => {});
    const fetchImplementation = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: { cancel },
    }));

    await expect(
      validateOpenAIKey("sk-sensitive", fetchImplementation),
    ).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        headers: { authorization: "Bearer sk-sensitive" },
      }),
    );
    expect(cancel).toHaveBeenCalled();
  });

  it("reports failed authentication without echoing the key or response", async () => {
    const fetchImplementation = vi.fn(async () => ({
      ok: false,
      status: 401,
      body: { cancel: vi.fn(async () => {}) },
    }));

    await expect(
      validateOpenAIKey("sk-sensitive", fetchImplementation),
    ).rejects.toThrow("OpenAI rejected the key (HTTP 401)");
    await expect(
      validateOpenAIKey("sk-sensitive", fetchImplementation),
    ).rejects.not.toThrow(/sk-sensitive/);
  });
});
