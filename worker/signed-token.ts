// HMAC-SHA256 tokens for the reviewer cookie. The main preview session keeps
// its own copy of the same primitive so its boundary stays self-contained.

const encoder = new TextEncoder();

export function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const standard = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(standard.padEnd(Math.ceil(standard.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return bytesToBase64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signToken(secret: string, payload: string) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(payload),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function verifyToken(
  secret: string,
  payload: string,
  signature: string,
) {
  const bytes = base64UrlToBytes(signature);
  if (!bytes) return false;
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    bytes,
    encoder.encode(payload),
  );
}

/** Constant-time equality over two strings of arbitrary length. */
export async function secretsMatch(candidate: string, expected: string) {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.byteLength; index += 1) difference |= a[index] ^ b[index];
  return difference === 0 && candidate.length === expected.length;
}
