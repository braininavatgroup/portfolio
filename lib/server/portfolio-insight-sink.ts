// First-party sink for the portfolio's own insight events.
//
// The client adapter in `lib/portfolio-analytics.ts` sends every `portfolio_*`
// event to Clarity, whose export API cannot return custom events. This sink
// receives the same validated payload and writes one Workers Analytics Engine
// data point per event, so `npm run insights` can read Reader attention,
// evidence opens, Guide navigation, contact actions and campaign codes from
// the terminal.
//
// It is dormant until `PORTFOLIO_INSIGHT_EVENTS_SINK` is exactly
// `analytics-engine` and the `PORTFOLIO_INSIGHTS` dataset is bound. Off, the
// endpoint answers 204 without reading the body, which is the same answer it
// gives for a rejected event when on, so nothing about the response says
// whether the sink is live.
//
// Data point layout (fixed positions; an absent dimension is the empty string):
//
//   blob1   action          entry, content_open, content_attention, evidence_open,
//                           guide_evidence, contact_action, ...
//   blob2   content_id      record or thread the event belongs to
//   blob3   content_kind    record | thread
//   blob4   campaign        opaque campaign code, or empty for a direct visit
//   blob5   contact_kind    contact route kind, on contact_action
//   blob6   source          selection_source | entry_source | evidence_source
//   blob7   target          target_id (guide_evidence) | evidence_id (evidence_open)
//   blob8   target_kind     target_kind (guide_evidence) | evidence_kind (evidence_open)
//   blob9   country         ISO 3166-1 alpha-2 from the edge (`cf.country`)
//   blob10  device          mobile | tablet | desktop | unknown, derived from
//                           the user agent and nothing else of it kept
//   blob11  schema          "v2", so the layout can change without a re-read
//                           of old rows guessing which column meant what;
//                           v1 rows stop at this column
//   blob12  session_id      random per-tab id from the client's sessionStorage
//   blob13  region_code     `cf.regionCode`, at most 16 ASCII letters, digits, hyphens
//   blob14  city            `cf.city`, letters, marks, digits, space . ' - (at most 96)
//   blob15  metro_code      `cf.metroCode`, at most 16 ASCII letters and digits
//   double1 active_seconds      on content_attention
//   double2 completion_percent  on content_attention
//   index1  action
//
// Nothing else from the request is written: not the address, the user agent
// string, cookies, referrer, the URL, latitude, longitude, postal code, colo,
// or any other `cf` property. City is the most specific geography kept, and it
// only says where the network reports the request came from. Region, city and
// metro come from `request.cf` alone; a value outside its shape is stored
// empty. Content IDs, codes and the session id are the opaque values the client
// already restricts to `[A-Za-z0-9._:-]`; a malformed session id drops the event
// the same way a malformed dimension does.

export const INSIGHT_SINK_ANALYTICS_ENGINE = "analytics-engine";
export const MAX_INSIGHT_BODY_BYTES = 2 * 1_024;
const MAX_INSIGHT_DIMENSIONS = 8;
const SCHEMA_VERSION = "v2";
const ACTION_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;
const VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
export const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/u;
const COUNTRY_PATTERN = /^[A-Z]{2}$|^T1$/u;
const REGION_CODE_PATTERN = /^[A-Za-z0-9-]{1,16}$/u;
const CITY_PATTERN = /^[\p{L}\p{M}\p{N} .'-]{1,96}$/u;
const METRO_CODE_PATTERN = /^[A-Za-z0-9]{1,16}$/u;

export type PortfolioInsightPayload = {
  action: string;
  dimensions: Record<string, string>;
  /** Random per-tab journey id, or empty when the client sent none. */
  session_id: string;
};

export type InsightGeography = {
  country: string;
  regionCode: string;
  city: string;
  metroCode: string;
};

export type PortfolioInsightDataPoint = {
  blobs: string[];
  doubles: number[];
  indexes: string[];
};

export type PortfolioInsightDataset = {
  writeDataPoint(event: PortfolioInsightDataPoint): void;
};

export type PortfolioInsightRateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type PortfolioInsightSinkEnv = {
  PORTFOLIO_INSIGHT_EVENTS_SINK?: string;
  PORTFOLIO_INSIGHTS?: PortfolioInsightDataset;
  PORTFOLIO_INSIGHT_RATE_LIMITER?: PortfolioInsightRateLimiter;
};

export type DeviceClass = "mobile" | "tablet" | "desktop" | "unknown";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The same rules `trackPortfolioInsight` applies before it sends anything. */
export function parsePortfolioInsightPayload(input: unknown): PortfolioInsightPayload | null {
  if (!isRecord(input)) return null;
  const { action, dimensions = {}, session_id: sessionId } = input;
  if (typeof action !== "string" || !ACTION_PATTERN.test(action)) return null;
  // Absent is an event from a client without tab ids; present but malformed
  // rejects the whole event, as a malformed dimension does.
  if (
    sessionId !== undefined &&
    (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId))
  ) {
    return null;
  }
  if (!isRecord(dimensions)) return null;
  const entries = Object.entries(dimensions);
  if (entries.length > MAX_INSIGHT_DIMENSIONS) return null;
  const safe: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (
      !ACTION_PATTERN.test(key) ||
      typeof value !== "string" ||
      !VALUE_PATTERN.test(value)
    ) {
      return null;
    }
    safe[key] = value;
  }
  return {
    action,
    dimensions: safe,
    session_id: typeof sessionId === "string" ? sessionId : "",
  };
}

/** A coarse class is all the report needs; the string itself is never kept. */
export function deviceClassFromUserAgent(userAgent: string | null): DeviceClass {
  const value = userAgent?.trim() ?? "";
  if (!value) return "unknown";
  if (/\biPad\b|\bTablet\b|\bSilk\b/iu.test(value)) return "tablet";
  if (/\bAndroid\b/iu.test(value) && !/\bMobile\b/iu.test(value)) return "tablet";
  if (/\bMobi|\bAndroid\b|\biPhone\b|\biPod\b/iu.test(value)) return "mobile";
  return "desktop";
}

function bounded(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function first(dimensions: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (dimensions[key] !== undefined) return dimensions[key];
  }
  return "";
}

export function insightDataPoint(
  { action, dimensions, session_id: sessionId }: PortfolioInsightPayload,
  { country, regionCode, city, metroCode, device }: InsightGeography & { device: DeviceClass },
): PortfolioInsightDataPoint {
  return {
    blobs: [
      action,
      dimensions.content_id ?? "",
      dimensions.content_kind ?? "",
      dimensions.campaign ?? "",
      dimensions.contact_kind ?? "",
      first(dimensions, ["selection_source", "entry_source", "evidence_source"]),
      first(dimensions, ["target_id", "evidence_id"]),
      first(dimensions, ["target_kind", "evidence_kind"]),
      country,
      device,
      SCHEMA_VERSION,
      sessionId,
      regionCode,
      city,
      metroCode,
    ],
    doubles: [bounded(dimensions.active_seconds), bounded(dimensions.completion_percent)],
    indexes: [action],
  };
}

export function insightSinkActive(env: PortfolioInsightSinkEnv) {
  return (
    env.PORTFOLIO_INSIGHT_EVENTS_SINK === INSIGHT_SINK_ANALYTICS_ENGINE &&
    typeof env.PORTFOLIO_INSIGHTS?.writeDataPoint === "function"
  );
}

function accepted() {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/** Body bytes up to the cap, or null when the request is larger than that. */
async function readBoundedBody(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_INSIGHT_BODY_BYTES) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_INSIGHT_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function shaped(value: unknown, pattern: RegExp) {
  return typeof value === "string" && pattern.test(value) ? value : "";
}

/**
 * The only request properties the row keeps besides the device class. Country
 * keeps its v1 `cf-ipcountry` fallback; region, city and metro are read from
 * `request.cf` alone. Each property is named, so nothing else on `cf` can reach
 * the row.
 */
export function geographyOf(request: Request): InsightGeography {
  const cf = Reflect.get(request, "cf") as unknown;
  const edge: Record<string, unknown> = isRecord(cf) ? cf : {};
  const country =
    typeof edge.country === "string" ? edge.country : request.headers.get("cf-ipcountry") ?? "";
  return {
    country: shaped(country, COUNTRY_PATTERN),
    regionCode: shaped(edge.regionCode, REGION_CODE_PATTERN),
    city: shaped(edge.city, CITY_PATTERN),
    metroCode: shaped(edge.metroCode, METRO_CODE_PATTERN),
  };
}

/** A transient throttle key; the address is hashed and never written anywhere. */
async function throttleKey(connectingIp: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(connectingIp));
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function withinLimit(env: PortfolioInsightSinkEnv, request: Request) {
  const limiter = env.PORTFOLIO_INSIGHT_RATE_LIMITER;
  const connectingIp = request.headers.get("cf-connecting-ip");
  if (!limiter || !connectingIp) return true;
  try {
    const result = await limiter.limit({
      key: `portfolio-insight:${await throttleKey(connectingIp)}`,
    });
    return result.success;
  } catch {
    // Telemetry is not worth failing closed over; the body cap still holds.
    return true;
  }
}

export function createPortfolioInsightSink({ env }: { env: PortfolioInsightSinkEnv }) {
  return {
    async handle(request: Request) {
      if (request.method !== "POST") {
        return new Response(null, {
          status: 405,
          headers: { allow: "POST", "cache-control": "no-store" },
        });
      }
      if (!insightSinkActive(env)) return accepted();
      if (!(await withinLimit(env, request))) return accepted();

      const bytes = await readBoundedBody(request).catch(() => null);
      if (!bytes) return accepted();
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return accepted();
      }
      const payload = parsePortfolioInsightPayload(parsed);
      if (!payload) return accepted();

      try {
        env.PORTFOLIO_INSIGHTS!.writeDataPoint(
          insightDataPoint(payload, {
            ...geographyOf(request),
            device: deviceClassFromUserAgent(request.headers.get("user-agent")),
          }),
        );
      } catch {
        // A dataset outage must not surface to the visitor's page.
      }
      return accepted();
    },
  };
}
