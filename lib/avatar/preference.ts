type AvatarStorage = Pick<Storage, "getItem" | "setItem">;

export const avatarEnabledStorageKey = "portfolio-avatar-enabled:v1";

function browserStorage(): AvatarStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readAvatarEnabled(storage = browserStorage()) {
  try {
    return storage?.getItem(avatarEnabledStorageKey) !== "false";
  } catch {
    return true;
  }
}

export function writeAvatarEnabled(enabled: boolean, storage = browserStorage()) {
  try {
    storage?.setItem(avatarEnabledStorageKey, String(enabled));
  } catch {
    // A privacy-restricted storage area must not affect the page or its default state.
  }
}
