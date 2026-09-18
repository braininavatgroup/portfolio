import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handlePortfolioInsights } from "./portfolio-insights-job";
import { INSIGHTS_PREFIX } from "./portfolio-insights-store";

// Failure this pins: the dashboard names the person behind every assigned
// campaign code. Before BIV-527 that join ran only on Bradley's Mac; it now
// runs at the edge, and Cloudflare Access is the whole boundary. Access covers
// insights.braininavat.dance — but the same Worker also answers on
// workers.dev and on the portfolio's own hostnames, which it does not cover,
// so a route reachable without a verified assertion would publish names,
// campaign codes and outcomes to anyone who found the URL.
//
// Owner: worker/portfolio-insights-job.ts. Retire when the dashboard stops
// carrying identity, or when the Worker stops answering on any hostname
// outside the Access application.

const DASHBOARD = "<html>alexcode01 — Alex Rivera</html>";

/** Only the parts of R2 the route uses, plus a record of what it read. */
function fakeBucket(objects: Record<string, string>) {
  const reads: string[] = [];
  return {
    reads,
    bucket: {
      get: async (key: string) => {
        reads.push(key);
        const body = objects[key];
        return body === undefined ? null : { text: async () => body, body };
      },
    } as unknown as R2Bucket,
  };
}

let signing: CryptoKeyPair;
let jwk: JsonWebKey;

beforeEach(async () => {
  signing = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  jwk = await crypto.subtle.exportKey("jwk", signing.publicKey);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const base64Url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64").replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
const encodePart = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

/** An Access assertion, signed by `key` unless another is given. */
async function assertion({
  team,
  aud,
  email = "bradley@braininavat.dance",
  kid = "test-key",
  exp = Math.floor(Date.now() / 1000) + 3600,
  nbf,
  alg = "RS256",
  key,
}: {
  team: string;
  aud: string | string[];
  email?: string | null;
  kid?: string;
  exp?: number;
  nbf?: number;
  alg?: string;
  key?: CryptoKey;
}) {
  const header = encodePart({ alg, kid, typ: "JWT" });
  const payload = encodePart({
    iss: `https://${team}`,
    aud,
    exp,
    ...(nbf === undefined ? {} : { nbf }),
    ...(email === null ? {} : { email }),
  });
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key ?? signing.privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
}

/** The team's published signing keys, and a count of how often they were asked for. */
function stubCerts(keys: Array<JsonWebKey & { kid: string }> = [{ ...jwk, kid: "test-key" }]) {
  const fetched = vi.fn(async () => new Response(JSON.stringify({ keys }), { status: 200 }));
  vi.stubGlobal("fetch", fetched);
  return fetched;
}

let team: string;
let environment: Record<string, unknown>;
let store: ReturnType<typeof fakeBucket>;

beforeEach(() => {
  // A fresh team per test: the module caches signing keys by team, so a shared
  // one would let an earlier test's keys answer a later test's request.
  team = `team-${crypto.randomUUID()}.cloudflareaccess.com`;
  store = fakeBucket({ [`${INSIGHTS_PREFIX}dashboard.html`]: DASHBOARD });
  environment = {
    PORTFOLIO_INSIGHTS_HOST: "insights.braininavat.dance",
    PORTFOLIO_INSIGHTS_ACCESS_TEAM: team,
    PORTFOLIO_INSIGHTS_ACCESS_AUD: "aud-tag",
    PORTFOLIO_INSIGHTS_ACCESS_EMAILS: "bradley@braininavat.dance",
    PORTFOLIO_INSIGHTS_STORE: store.bucket,
  };
});

const request = (url: string, headers: Record<string, string> = {}, method = "GET") =>
  new Request(url, { method, headers });

const call = (input: Request) =>
  handlePortfolioInsights(input, environment as Parameters<typeof handlePortfolioInsights>[1]);

describe("insights dashboard route", () => {
  it("serves the dashboard to a valid assertion from an allowed identity", async () => {
    stubCerts();
    const response = await call(
      request("https://insights.braininavat.dance/", {
        "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag" }),
      }),
    );
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe(DASHBOARD);
    expect(response?.headers.get("cache-control")).toBe("no-store, private");
    expect(response?.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("accepts the assertion from Access's cookie as well as its header", async () => {
    stubCerts();
    const response = await call(
      request("https://insights.braininavat.dance/", {
        cookie: `other=1; CF_Authorization=${await assertion({ team, aud: "aud-tag" })}`,
      }),
    );
    expect(response?.status).toBe(200);
  });

  // Every one of these is a token that exists but does not authorize this
  // request. Each must be refused without the bucket being read at all: a 403
  // that still fetched the page is one HTMLRewriter bug away from leaking it.
  it.each([
    ["no assertion at all", async () => ({})],
    ["an unsigned token", async () => ({ "cf-access-jwt-assertion": "not.a.jwt" })],
    [
      "a token for another Access application",
      async () => ({ "cf-access-jwt-assertion": await assertion({ team, aud: "someone-elses-tag" }) }),
    ],
    [
      "an expired token",
      async () => ({
        "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag", exp: Math.floor(Date.now() / 1000) - 1 }),
      }),
    ],
    [
      "a token that is not valid yet",
      async () => ({
        "cf-access-jwt-assertion": await assertion({
          team,
          aud: "aud-tag",
          nbf: Math.floor(Date.now() / 1000) + 600,
        }),
      }),
    ],
    [
      "a token carrying no identity",
      async () => ({ "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag", email: null }) }),
    ],
    [
      "a token for someone who is not allowed",
      async () => ({
        "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag", email: "stranger@example.com" }),
      }),
    ],
    [
      "a token signed by a key this team does not publish",
      async () => ({ "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag", kid: "unpublished" }) }),
    ],
  ])("refuses %s, without reading the dashboard", async (_name, headers) => {
    stubCerts();
    const response = await call(request("https://insights.braininavat.dance/", await headers()));
    expect(response?.status).toBe(403);
    expect(await response?.text()).not.toContain("Alex Rivera");
    expect(store.reads).toEqual([]);
  });

  // A token whose header says RS256 but which was signed by a key the team did
  // publish under that kid — a forgery that only signature verification catches.
  it("refuses a token signed by the wrong private key for a published kid", async () => {
    stubCerts();
    const impostor = (await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const response = await call(
      request("https://insights.braininavat.dance/", {
        "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag", key: impostor.privateKey }),
      }),
    );
    expect(response?.status).toBe(403);
    expect(store.reads).toEqual([]);
  });

  it("refuses a token issued by a different Access team", async () => {
    stubCerts();
    const response = await call(
      request("https://insights.braininavat.dance/", {
        "cf-access-jwt-assertion": await assertion({ team: "someone-else.cloudflareaccess.com", aud: "aud-tag" }),
      }),
    );
    expect(response?.status).toBe(403);
    expect(store.reads).toEqual([]);
  });

  // Fails closed: a hostname configured before its Access application exists
  // must serve nothing, rather than serving the dashboard ungated.
  it.each([
    "PORTFOLIO_INSIGHTS_ACCESS_TEAM",
    "PORTFOLIO_INSIGHTS_ACCESS_AUD",
    "PORTFOLIO_INSIGHTS_ACCESS_EMAILS",
  ])("refuses every request when %s is unset", async (missing) => {
    stubCerts();
    delete environment[missing];
    const response = await call(
      request("https://insights.braininavat.dance/", {
        "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag" }),
      }),
    );
    expect(response?.status).toBe(403);
    expect(store.reads).toEqual([]);
  });

  // The portfolio's own hostnames run this same Worker and are not covered by
  // any Access application. The route must decline them, not gate them.
  it.each([
    "https://bradleyberkman.com/",
    "https://www.bradleyberkman.com/",
    "https://bradley-portfolio-main-preview.workers.dev/",
  ])("is not reachable on %s", async (url) => {
    stubCerts();
    const response = await call(
      request(url, { "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag" }) }),
    );
    expect(response).toBeNull();
    expect(store.reads).toEqual([]);
  });

  it("answers nothing anywhere when no insights hostname is configured", async () => {
    stubCerts();
    delete environment.PORTFOLIO_INSIGHTS_HOST;
    expect(await call(request("https://insights.braininavat.dance/"))).toBeNull();
  });

  it("serves only the dashboard, and only to a read", async () => {
    stubCerts();
    const authorized = { "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag" }) };
    expect((await call(request("https://insights.braininavat.dance/history.jsonl", authorized)))?.status).toBe(404);
    expect(
      (await call(request("https://insights.braininavat.dance/", authorized, "POST")))?.status,
    ).toBe(405);
    expect(store.reads).toEqual([]);
  });

  it("says no run has produced a dashboard rather than erroring", async () => {
    stubCerts();
    store = fakeBucket({});
    environment.PORTFOLIO_INSIGHTS_STORE = store.bucket;
    const response = await call(
      request("https://insights.braininavat.dance/", {
        "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag" }),
      }),
    );
    expect(response?.status).toBe(404);
  });

  it("fetches the team's signing keys once and reuses them", async () => {
    const fetched = stubCerts();
    const headers = { "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag" }) };
    expect((await call(request("https://insights.braininavat.dance/", headers)))?.status).toBe(200);
    expect((await call(request("https://insights.braininavat.dance/", headers)))?.status).toBe(200);
    expect(fetched).toHaveBeenCalledTimes(1);
  });

  // A failed certs fetch must not become a cached refusal for the isolate's life.
  it("retries the signing keys after a failed fetch", async () => {
    const failing = vi.fn(async () => new Response("down", { status: 500 }));
    vi.stubGlobal("fetch", failing);
    const headers = { "cf-access-jwt-assertion": await assertion({ team, aud: "aud-tag" }) };
    expect((await call(request("https://insights.braininavat.dance/", headers)))?.status).toBe(403);
    stubCerts();
    expect((await call(request("https://insights.braininavat.dance/", headers)))?.status).toBe(200);
  });
});
