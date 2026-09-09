// The chat endpoint's session token. A visitor gets one when the Guide mounts,
// and it rides along as an HttpOnly cookie from then on.
//
// This is deliberately a speed bump, not a wall: it means the endpoint cannot
// be driven by a bare script that never loads the site, and it costs a real
// visitor nothing — no box, no click, no third-party iframe. Anyone willing to
// fetch a session first can still ask questions, which is fine. The per-IP
// throttle and the global daily budget are what actually bound the damage.

import { portfolioChatSessionHeader } from "../portfolio-chat-protocol";

const encoder = new TextEncoder();

export const sessionCookieName = "pc_session";
export const sessionHeaderName = portfolioChatSessionHeader;
export const sessionLifetimeSeconds = 1_800;
export const sessionCookiePath = "/api/portfolio-chat";

const sessionVersion = "v1";
const maxCookieLength = 512;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))),
  );
}

/** The actor key already digests the address, so the payload never holds an IP. */
function payload(actorKey: string, expiresAt: number) {
  return `portfolio-chat-session:${sessionVersion}:${actorKey}:${expiresAt}`;
}

/** Length-safe comparison; both operands are base64url of a fixed-size digest. */
function signaturesMatch(candidate: string, expected: string) {
  if (candidate.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    difference |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function readCookie(header: string | null, name: string) {
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    return pair.slice(separator + 1).trim();
  }
  return undefined;
}

export async function mintSession({
  secret,
  actorKey,
  now,
  lifetimeSeconds = sessionLifetimeSeconds,
}: {
  secret: string;
  actorKey: string;
  now: number;
  lifetimeSeconds?: number;
}) {
  const expiresAt = Math.floor(now / 1_000) + lifetimeSeconds;
  const signature = await sign(secret, payload(actorKey, expiresAt));
  return {
    expiresAt,
    setCookie: [
      `${sessionCookieName}=${sessionVersion}.${expiresAt}.${signature}`,
      `Path=${sessionCookiePath}`,
      `Max-Age=${lifetimeSeconds}`,
      "Secure",
      "HttpOnly",
      "SameSite=Lax",
    ].join("; "),
  };
}

/** Returns the expiry when the cookie is a live session for this actor. */
export async function verifySession({
  cookieHeader,
  secret,
  actorKey,
  now,
}: {
  cookieHeader: string | null;
  secret: string;
  actorKey: string;
  now: number;
}) {
  const cookie = readCookie(cookieHeader, sessionCookieName);
  if (!cookie || cookie.length > maxCookieLength) return null;
  const [version, rawExpiry, signature] = cookie.split(".");
  if (version !== sessionVersion || !rawExpiry || !signature) return null;
  if (!/^\d{1,15}$/.test(rawExpiry)) return null;
  const expiresAt = Number(rawExpiry);
  if (expiresAt <= Math.floor(now / 1_000)) return null;
  const expected = await sign(secret, payload(actorKey, expiresAt));
  return signaturesMatch(signature, expected) ? expiresAt : null;
}
