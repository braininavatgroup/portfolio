import { describe, expect, it, vi } from "vitest";
import {
  avatarEnabledStorageKey,
  readAvatarEnabled,
  writeAvatarEnabled,
} from "./preference";

describe("avatar visibility preference", () => {
  it("uses the versioned storage key and only disables for the false string", () => {
    // Catches malformed or future stored values that could permanently hide the assistant.
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    values.set(avatarEnabledStorageKey, "garbled");
    expect(readAvatarEnabled(storage)).toBe(true);
    values.set(avatarEnabledStorageKey, "false");
    expect(readAvatarEnabled(storage)).toBe(false);

    writeAvatarEnabled(false, storage);
    expect(avatarEnabledStorageKey).toBe("portfolio-avatar-enabled:v1");
    expect(values.get("portfolio-avatar-enabled:v1")).toBe("false");
    writeAvatarEnabled(true, storage);
    expect(values.get("portfolio-avatar-enabled:v1")).toBe("true");
  });

  it("defaults to enabled when storage reads or writes fail", () => {
    // Catches private-mode storage exceptions that could break the page or hide the assistant.
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    };

    expect(readAvatarEnabled(throwingStorage)).toBe(true);
    expect(() => writeAvatarEnabled(false, throwingStorage)).not.toThrow();
  });
});
