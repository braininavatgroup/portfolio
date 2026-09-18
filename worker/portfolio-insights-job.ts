// The portfolio insights dashboard, produced and served entirely at the edge.
//
// A daily cron runs the same `runInsights` the CLI runs — same sources, same
// report, same render — with its records in R2 and its tokens in Worker
// secrets, and leaves `dashboard.html` behind. A request to the insights
// hostname serves that page and nothing else.
//
// The privacy boundary is logical, not physical. Until BIV-527 the join from
// an opaque campaign code to a person's name ran only on Bradley's Mac, under
// a login-Keychain token, into a 0700 directory. It now runs here, so the
// dashboard names people, and the only thing standing between it and the
// internet is Cloudflare Access.
//
// That makes the gate load-bearing, so this module does not assume the edge
// applied it. Access runs ahead of Workers on a route it covers — but the same
// Worker also answers on `workers.dev` and on the portfolio's own hostnames,
// which no Access application covers. So every insights request must carry an
// Access assertion this module verifies itself: RS256 against the team's
// published keys, audience equal to this application's tag, unexpired, and
// issued to an allowed identity. A request without one is refused here, having
// read nothing from R2.

import { runInsights } from "../scripts/portfolio-insights-core.mjs";
import { INSIGHTS_PREFIX, r2InsightStorage } from "./portfolio-insights-store";

export type PortfolioInsightsEnv = {
  /** The hostname the dashboard answers on. Unset disables the route entirely. */
  PORTFOLIO_INSIGHTS_HOST?: string;
  /** The Access team domain. BiV's is `biv.cloudflareaccess.com`. */
  PORTFOLIO_INSIGHTS_ACCESS_TEAM?: string;
  /** The Access application's AUD tag. A token for another application is not for this one. */
  PORTFOLIO_INSIGHTS_ACCESS_AUD?: string;
  /** Comma-separated identities allowed to read the dashboard. */
  PORTFOLIO_INSIGHTS_ACCESS_EMAILS?: string;
  /** How many days each scheduled run reads. */
  PORTFOLIO_INSIGHTS_DAYS?: string;
  PORTFOLIO_INSIGHTS_STORE?: R2Bucket;
  /** Account Analytics Read plus Zone Analytics Read: Web Analytics, edge counts, Analytics Engine. */
  CLOUDFLARE_API_TOKEN?: string;
  CLARITY_API_TOKEN?: string;
  PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN?: string;
};

const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const ACCESS_JWT_COOKIE = "CF_Authorization";
/** Access publishes signing keys here and rotates them; a short cache absorbs a day of requests. */
const CERTS_TTL_MS = 3_600_000;

type CachedCerts = { at: number; keys: Map<string, CryptoKey> };
let certsCache: { team: string; value: Promise<CachedCerts> } | null = null;

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]*$/u.test(value)) return null;
  try {
    const standard = value.replace(/-/gu, "+").replace(/_/gu, "/");
    const binary = atob(standard.padEnd(Math.ceil(standard.length / 4) * 4, "="));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function loadCerts(team: string): Promise<CachedCerts> {
  const response = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs returned ${response.status}`);
  const payload = (await response.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of payload.keys ?? []) {
    if (!jwk.kid) continue;
    keys.set(
      jwk.kid,
      await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      ),
    );
  }
  if (keys.size === 0) throw new Error("Access published no usable signing keys");
  return { at: Date.now(), keys };
}

async function signingKey(team: string, kid: string) {
  const cached = certsCache?.team === team ? certsCache.value : null;
  if (cached) {
    const certs = await cached.catch(() => null);
    if (certs && Date.now() - certs.at < CERTS_TTL_MS && certs.keys.has(kid)) return certs.keys.get(kid) ?? null;
  }
  // A key this isolate has not seen — a rotation, or a first request — is worth
  // one fetch; a failed fetch must not poison the cache for the next request.
  const pending = loadCerts(team);
  certsCache = { team, value: pending };
  try {
    return (await pending).keys.get(kid) ?? null;
  } catch (error) {
    certsCache = null;
    throw error;
  }
}

function assertionFrom(request: Request) {
  const header = request.headers.get(ACCESS_JWT_HEADER);
  if (header) return header.trim();
  const cookies = request.headers.get("cookie") ?? "";
  for (const pair of cookies.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name === ACCESS_JWT_COOKIE && rest.length > 0) return rest.join("=").trim();
  }
  return null;
}

/**
 * The identity an Access assertion proves, or null. Null covers every reason a
 * token is not good enough — absent, malformed, signed by a key this team does
 * not publish, issued for another application, expired, not yet valid, or
 * carrying an identity that is not allowed — because the answer to all of them
 * is the same refusal.
 */
export async function verifyAccessAssertion(
  request: Request,
  { team, aud, emails }: { team: string; aud: string; emails: Set<string> },
): Promise<string | null> {
  const token = assertionFrom(request);
  if (!token) return null;
  const [headerPart, payloadPart, signaturePart, ...extra] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart || extra.length > 0) return null;

  const decode = (part: string) => {
    const bytes = base64UrlToBytes(part);
    if (!bytes) return null;
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  const header = decode(headerPart);
  const payload = decode(payloadPart);
  const signature = base64UrlToBytes(signaturePart);
  if (!header || !payload || !signature) return null;
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

  const key = await signingKey(team, header.kid).catch(() => null);
  if (!key) return null;
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature as BufferSource,
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!verified) return null;

  if (payload.iss !== `https://${team}`) return null;
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audience.includes(aud)) return null;
  const seconds = Date.now() / 1000;
  if (typeof payload.exp !== "number" || payload.exp <= seconds) return null;
  if (typeof payload.nbf === "number" && payload.nbf > seconds) return null;

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  if (!email || !emails.has(email)) return null;
  return email;
}

/** Nothing here belongs in a cache, a search index, or another site's frame. */
function privateHeaders(type: string) {
  return {
    "content-type": type,
    "cache-control": "no-store, private",
    "x-robots-tag": "noindex, nofollow, noarchive",
    "referrer-policy": "no-referrer",
    "content-security-policy": "frame-ancestors 'none'",
  };
}

function refuse(status: number, message: string) {
  return new Response(`${message}\n`, { status, headers: privateHeaders("text/plain; charset=utf-8") });
}

/**
 * The dashboard route, or null when this request is not for it — in which case
 * the caller goes on serving the portfolio. Only a request to the configured
 * insights hostname is ever answered here, so the portfolio's own hostnames
 * expose none of this even if a route is added to them by mistake.
 */
export async function handlePortfolioInsights(
  request: Request,
  env: PortfolioInsightsEnv,
): Promise<Response | null> {
  const host = env.PORTFOLIO_INSIGHTS_HOST?.trim();
  if (!host) return null;
  const url = new URL(request.url);
  if (url.hostname !== host) return null;

  const team = env.PORTFOLIO_INSIGHTS_ACCESS_TEAM?.trim();
  const aud = env.PORTFOLIO_INSIGHTS_ACCESS_AUD?.trim();
  const emails = new Set(
    (env.PORTFOLIO_INSIGHTS_ACCESS_EMAILS ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
  // A hostname configured without its gate serves nothing. Failing closed here
  // is the difference between a misconfiguration and a disclosure.
  if (!team || !aud || emails.size === 0) return refuse(403, "The insights dashboard is not configured.");

  const identity = await verifyAccessAssertion(request, { team, aud, emails });
  if (!identity) return refuse(403, "Cloudflare Access did not authenticate this request.");

  if (request.method !== "GET" && request.method !== "HEAD") return refuse(405, "Method not allowed.");
  if (url.pathname !== "/") return refuse(404, "Not found.");

  const bucket = env.PORTFOLIO_INSIGHTS_STORE;
  if (!bucket) return refuse(503, "The insights store is not bound.");
  const page = await bucket.get(`${INSIGHTS_PREFIX}dashboard.html`);
  if (!page) return refuse(404, "No run has produced a dashboard yet.");
  return new Response(request.method === "HEAD" ? null : page.body, {
    headers: privateHeaders("text/html; charset=utf-8"),
  });
}

/** How many days a scheduled run reads. The report accepts 1 to 30. */
function scheduledDays(env: PortfolioInsightsEnv) {
  const requested = Number.parseInt(env.PORTFOLIO_INSIGHTS_DAYS ?? "", 10);
  return Number.isFinite(requested) && requested >= 1 && requested <= 30 ? requested : 7;
}

/**
 * One scheduled run. Every source resolves on its own and a partial run still
 * rewrites the dashboard, so a Clarity outage or a spent request budget costs
 * that source's panel, not the day's page.
 */
export async function runScheduledInsights(env: PortfolioInsightsEnv, now = () => new Date()) {
  const bucket = env.PORTFOLIO_INSIGHTS_STORE;
  if (!bucket) throw new Error("PORTFOLIO_INSIGHTS_STORE is not bound");
  return runInsights(
    {
      days: scheduledDays(env),
      json: false,
      clarity: true,
      cloudflare: true,
      insights: true,
      airtable: true,
      snapshot: true,
      history: false,
      dashboard: false,
    },
    {
      directory: INSIGHTS_PREFIX,
      storage: r2InsightStorage(bucket),
      // Tokens are Worker secrets. There is no Keychain at the edge, and a
      // reader that throws keeps `resolveToken` on its environment branch.
      env: {
        CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
        CLARITY_API_TOKEN: env.CLARITY_API_TOKEN,
        PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN: env.PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN,
      },
      readKeychain: async () => {
        throw new Error("no Keychain at the edge");
      },
      readContent: async () => (await import("../content/portfolio-content.json")).default,
      now,
    },
  );
}
