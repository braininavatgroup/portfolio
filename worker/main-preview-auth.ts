import {
  excludeFromSearch,
  isSupportingRoute,
  setAnalyticsContext,
} from "./public-portfolio";

export interface MainPreviewAuthEnv {
  PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED?: string;
  PORTFOLIO_MAIN_PREVIEW_PASSWORD?: string;
  PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET?: string;
}

const LOGIN_PATH = "/_portfolio-preview/login";
const COOKIE_NAME = "portfolio_main_preview_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const MAX_LOGIN_BODY_BYTES = 4 * 1_024;
const PROTECTED_ROBOTS_TAG = "noindex, nofollow, noarchive";
const encoder = new TextEncoder();

type WorkerSubtleCrypto = SubtleCrypto & {
  timingSafeEqual?: (left: ArrayBufferView, right: ArrayBufferView) => boolean;
};

function addNoIndex(response: Response) {
  return setAnalyticsContext(excludeFromSearch(response), "preview");
}

function privateResponse(
  body: BodyInit | null,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", PROTECTED_ROBOTS_TAG);
  return new Response(body, { ...init, headers });
}

function redirect(location: string, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("location", location);
  return privateResponse(null, { status: 303, headers: responseHeaders });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function safeReturnPath(candidate: string | null, requestUrl: string) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/";
  }

  try {
    const requestOrigin = new URL(requestUrl).origin;
    const target = new URL(candidate, requestOrigin);
    if (target.origin !== requestOrigin || candidate.includes("\\")) {
      return "/";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

function loginPage(next: string, hasError = false) {
  const action = `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
  const error = hasError
    ? '<p class="error" role="alert">That password did not work.</p>'
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Portfolio preview</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #101010; color: #f5f5f2; }
    main { width: min(28rem, calc(100% - 2rem)); padding: 2rem; border: 1px solid #363636; border-radius: 1rem; background: #191919; }
    h1 { margin: 0 0 .5rem; font-size: 1.5rem; }
    p { color: #bdbdb6; }
    label { display: grid; gap: .5rem; margin-top: 1.5rem; font-weight: 600; }
    input, button { width: 100%; border-radius: .6rem; padding: .8rem .9rem; font: inherit; }
    input { border: 1px solid #555; background: #0f0f0f; color: inherit; }
    button { margin-top: 1rem; border: 0; background: #f5f5f2; color: #101010; font-weight: 700; cursor: pointer; }
    .error { color: #ffaaa2; }
  </style>
</head>
<body>
  <main>
    <h1>Bradley Berkman</h1>
    <p>This portfolio draft is private. Enter the shared password to continue.</p>
    ${error}
    <form method="post" action="${escapeHtml(action)}">
      <label>Password<input name="password" type="password" autocomplete="current-password" required autofocus></label>
      <button type="submit">View preview</button>
    </form>
  </main>
</body>
</html>`;
}

function renderLogin(next: string, status = 200, hasError = false) {
  return privateResponse(loginPage(next, hasError), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function readBoundedBody(request: Request) {
  if (!request.body) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_LOGIN_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string) {
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

async function passwordMatches(candidate: string, expected: string) {
  const [candidateDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(candidateDigest);
  const right = new Uint8Array(expectedDigest);
  const subtle = crypto.subtle as WorkerSubtleCrypto;

  if (typeof subtle.timingSafeEqual === "function") {
    return subtle.timingSafeEqual(left, right);
  }

  let difference = left.byteLength ^ right.byteLength;
  for (let index = 0; index < Math.max(left.byteLength, right.byteLength); index += 1) {
    difference |= left[index % left.byteLength] ^ right[index % right.byteLength];
  }
  return difference === 0;
}

async function sessionKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createSession(secret: string, now: number) {
  const payload = `v1.${now + SESSION_SECONDS * 1_000}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await sessionKey(secret),
    encoder.encode(payload),
  );
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function validSession(value: string | null, secret: string, now: number) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;

  const expiresAt = Number(parts[1]);
  const signature = base64UrlToBytes(parts[2]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || !signature) {
    return false;
  }

  return crypto.subtle.verify(
    "HMAC",
    await sessionKey(secret),
    signature,
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
}

function requestCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator === -1) continue;
    if (cookie.slice(0, separator).trim() === COOKIE_NAME) {
      return cookie.slice(separator + 1).trim();
    }
  }
  return null;
}

async function handleLogin(
  request: Request,
  password: string,
  sessionSecret: string,
  now: () => number,
) {
  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get("next"), request.url);

  if (request.method === "GET" || request.method === "HEAD") {
    const response = renderLogin(next);
    return request.method === "HEAD"
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  }

  if (request.method !== "POST") {
    return privateResponse("Method not allowed", {
      status: 405,
      headers: { allow: "GET, HEAD, POST" },
    });
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    return privateResponse("Unsupported media type", { status: 415 });
  }

  const body = await readBoundedBody(request);
  if (!body) {
    return privateResponse("Request too large", { status: 413 });
  }

  const submittedPassword = new URLSearchParams(new TextDecoder().decode(body)).get("password") ?? "";
  if (!(await passwordMatches(submittedPassword, password))) {
    return renderLogin(next, 401, true);
  }

  const session = await createSession(sessionSecret, now());
  return redirect(next, {
    "set-cookie": `${COOKIE_NAME}=${session}; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax; Path=/`,
  });
}

export async function withMainPreviewPassword(
  request: Request,
  env: MainPreviewAuthEnv,
  next: () => Promise<Response>,
  now: () => number = Date.now,
): Promise<Response> {
  const url = new URL(request.url);
  const password = env.PORTFOLIO_MAIN_PREVIEW_PASSWORD;
  const sessionSecret = env.PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET;
  const credentials =
    password && sessionSecret && sessionSecret.length >= 32
      ? { password, sessionSecret }
      : null;

  // Once the portfolio is public the flag is off, but the copy deck and the
  // design gallery are Bradley's working surfaces, not portfolio pages. They
  // keep the same password as long as it is configured. Where it is not --
  // local development, a workers.dev preview -- they stay open, exactly as
  // they are today; the gate is not something to fail closed on for a
  // surface that has no password to give.
  if (env.PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED !== "true") {
    if (!credentials || !isSupportingRoute(url.pathname)) {
      return next();
    }
  } else if (!credentials) {
    return privateResponse("Preview unavailable", { status: 503 });
  }

  if (url.pathname === LOGIN_PATH) {
    return handleLogin(request, credentials.password, credentials.sessionSecret, now);
  }

  if (await validSession(requestCookie(request), credentials.sessionSecret, now())) {
    return addNoIndex(await next());
  }

  if (request.method === "GET" || request.method === "HEAD") {
    const returnPath = `${url.pathname}${url.search}`;
    return redirect(`${LOGIN_PATH}?next=${encodeURIComponent(returnPath)}`);
  }

  return privateResponse(JSON.stringify({ error: "Authentication required" }), {
    status: 401,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
