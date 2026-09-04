// Reviewer feedback on the password-protected preview.
//
// A design partner opens the site through a link carrying `?r=<code>`. The
// worker turns that into a signed, readable `portfolio_reviewer` cookie and
// redirects to a URL carrying the normalized reviewer name. The feedback
// widget mounts only when that URL marker matches the cookie, posts notes here,
// and keeps the visit's own notes in memory — nothing is written back into the page, so no reviewer's
// later session, and no other reviewer, ever sees a note. Bradley reads the
// whole ledger through the bearer-protected admin route.
//
// `withPortfolioFeedback` runs inside the password gate: the reviewer routes
// require both the preview session and the reviewer cookie. The admin route
// runs outside it, authenticated by its own token, so a script can pull notes.

import {
  feedbackNotesToMarkdown,
  normalizeReviewerCode,
  readFeedbackNoteInput,
  REVIEWER_CODE,
  type FeedbackNote,
} from "./portfolio-feedback-store";
import { secretsMatch, signToken, verifyToken } from "./signed-token";

export interface PortfolioFeedbackEnv {
  PORTFOLIO_FEEDBACK_ENABLED?: string;
  PORTFOLIO_FEEDBACK_ADMIN_TOKEN?: string;
  PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET?: string;
  PORTFOLIO_FEEDBACK?: PortfolioFeedbackNamespace;
}

export type PortfolioFeedbackNamespace = {
  getByName(name: string): { fetch(request: Request): Promise<Response> };
};

export const REVIEWER_COOKIE = "portfolio_reviewer";
export const REVIEWER_PARAM = "r";
export const REVIEWER_MARKER_PARAM = "reviewer";
export const FEEDBACK_NOTES_PATH = "/_portfolio-feedback/notes";
export const FEEDBACK_ADMIN_PATH = "/_portfolio-feedback/admin/notes";
const REVIEWER_COOKIE_SECONDS = 90 * 24 * 60 * 60;
const MAX_NOTE_BODY_BYTES = 16 * 1_024;
const MIN_SECRET_LENGTH = 32;
const LEDGER_NAME = "portfolio-feedback";

function privateJson(status: number, body: unknown) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function requestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator === -1) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return cookie.slice(separator + 1).trim();
    }
  }
  return null;
}

function reviewerPayload(code: string) {
  return `reviewer.v1.${code}`;
}

export async function createReviewerCookieValue(secret: string, code: string) {
  return `v1.${code}.${await signToken(secret, reviewerPayload(code))}`;
}

/** The reviewer code carried by a valid cookie, or null. */
export async function readReviewer(request: Request, secret: string) {
  const value = requestCookie(request, REVIEWER_COOKIE);
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, code, signature] = parts;
  if (!REVIEWER_CODE.test(code)) return null;
  return (await verifyToken(secret, reviewerPayload(code), signature)) ? code : null;
}

function feedbackReady(env: PortfolioFeedbackEnv) {
  const secret = env.PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET;
  return (
    env.PORTFOLIO_FEEDBACK_ENABLED === "true" &&
    typeof secret === "string" &&
    secret.length >= MIN_SECRET_LENGTH &&
    Boolean(env.PORTFOLIO_FEEDBACK)
  );
}

function ledger(env: PortfolioFeedbackEnv) {
  return env.PORTFOLIO_FEEDBACK!.getByName(LEDGER_NAME);
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_NOTE_BODY_BYTES) return undefined;
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_NOTE_BODY_BYTES) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

async function handleReviewerLink(url: URL, secret: string) {
  const code = normalizeReviewerCode(url.searchParams.get(REVIEWER_PARAM));
  const destination = new URL(url);
  destination.searchParams.delete(REVIEWER_PARAM);
  destination.searchParams.delete(REVIEWER_MARKER_PARAM);
  if (code) destination.searchParams.set(REVIEWER_MARKER_PARAM, code);
  const location = `${destination.pathname}${destination.search}${destination.hash}`;
  const headers = new Headers({
    "cache-control": "no-store",
    location,
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  if (code) {
    const value = await createReviewerCookieValue(secret, code);
    // `Secure` only over https: the local dev server is plain http and some
    // embedded browsers drop Secure cookies there. Production is always https.
    const secure = url.protocol === "https:" ? " Secure;" : "";
    headers.set(
      "set-cookie",
      `${REVIEWER_COOKIE}=${value}; Max-Age=${REVIEWER_COOKIE_SECONDS};${secure} SameSite=Lax; Path=/`,
    );
  }
  return new Response(null, { status: 303, headers });
}

/**
 * Reviewer-facing half. Mount inside the password gate.
 */
export async function withPortfolioFeedback(
  request: Request,
  env: PortfolioFeedbackEnv,
  next: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  const isFeedbackRoute = url.pathname.startsWith("/_portfolio-feedback/");

  if (!feedbackReady(env)) {
    return isFeedbackRoute ? privateJson(404, { error: "Feedback is not enabled" }) : next();
  }
  const secret = env.PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET!;

  if (
    (request.method === "GET" || request.method === "HEAD") &&
    url.searchParams.has(REVIEWER_PARAM) &&
    !isFeedbackRoute
  ) {
    return handleReviewerLink(url, secret);
  }

  if (!isFeedbackRoute) return next();
  if (url.pathname === FEEDBACK_ADMIN_PATH) return privateJson(404, { error: "Not found" });

  const reviewer = await readReviewer(request, secret);
  if (!reviewer) return privateJson(401, { error: "Reviewer link required" });

  if (url.pathname === FEEDBACK_NOTES_PATH && request.method === "POST") {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return privateJson(415, { error: "Unsupported media type" });
    }
    const body = await readBoundedJson(request);
    if (body === undefined) return privateJson(400, { error: "body" });
    const read = readFeedbackNoteInput(body, reviewer);
    if ("error" in read) return privateJson(400, { error: read.error });

    const stored = await ledger(env).fetch(
      new Request("https://portfolio-feedback/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(read.input),
      }),
    );
    return privateJson(stored.status, await stored.json());
  }

  const deleteMatch = url.pathname.match(
    new RegExp(`^${FEEDBACK_NOTES_PATH}/([A-Za-z0-9-]{1,64})$`, "u"),
  );
  if (deleteMatch && request.method === "DELETE") {
    const stored = await ledger(env).fetch(
      new Request(
        `https://portfolio-feedback/notes/${deleteMatch[1]}?reviewer=${encodeURIComponent(reviewer)}`,
        { method: "DELETE" },
      ),
    );
    return privateJson(stored.status, await stored.json());
  }

  return privateJson(404, { error: "Not found" });
}

/**
 * Bradley's half. Mount outside the password gate; returns null for every
 * request that is not the admin route.
 */
export async function handlePortfolioFeedbackAdmin(
  request: Request,
  env: PortfolioFeedbackEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== FEEDBACK_ADMIN_PATH) return null;
  if (request.method !== "GET") {
    return privateJson(405, { error: "Method not allowed" });
  }

  const token = env.PORTFOLIO_FEEDBACK_ADMIN_TOKEN;
  if (!feedbackReady(env) || !token || token.length < MIN_SECRET_LENGTH) {
    return privateJson(404, { error: "Feedback is not enabled" });
  }
  const presented = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/iu)?.[1] ?? "";
  if (!(await secretsMatch(presented, token))) {
    return privateJson(401, { error: "Unauthorized" });
  }

  const stored = await ledger(env).fetch(new Request("https://portfolio-feedback/notes"));
  if (stored.status !== 200) return privateJson(502, { error: "Ledger unavailable" });
  const { notes } = (await stored.json()) as { notes: FeedbackNote[] };

  if (url.searchParams.get("format") === "markdown") {
    return new Response(feedbackNotesToMarkdown(notes), {
      headers: {
        "cache-control": "no-store",
        "content-type": "text/markdown; charset=utf-8",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
    });
  }
  return privateJson(200, { notes });
}
