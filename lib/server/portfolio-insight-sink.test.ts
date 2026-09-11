import { describe, expect, it, vi } from "vitest";
import {
  createPortfolioInsightSink,
  deviceClassFromUserAgent,
  insightDataPoint,
  insightSinkActive,
  MAX_INSIGHT_BODY_BYTES,
  parsePortfolioInsightPayload,
} from "./portfolio-insight-sink";

function insightRequest(
  body: string | object,
  {
    cf,
    headers = {},
    method = "POST",
  }: {
    cf?: Record<string, unknown>;
    headers?: Record<string, string>;
    method?: string;
  } = {},
) {
  const request = new Request("https://bradleyberkman.com/api/portfolio-insight", {
    method,
    headers: {
      "content-type": typeof body === "string" ? "text/plain;charset=UTF-8" : "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  if (cf) Object.defineProperty(request, "cf", { value: cf });
  return request;
}

function dataset() {
  return { writeDataPoint: vi.fn() };
}

const activeEnv = { PORTFOLIO_INSIGHT_EVENTS_SINK: "analytics-engine" };

const noGeography = { country: "", regionCode: "", city: "", metroCode: "" };

/** The blobs of the one point a request wrote, or undefined when it wrote none. */
async function writtenBlobs(
  body: object,
  options: { cf?: Record<string, unknown>; headers?: Record<string, string> } = {},
) {
  const PORTFOLIO_INSIGHTS = dataset();
  const sink = createPortfolioInsightSink({ env: { ...activeEnv, PORTFOLIO_INSIGHTS } });
  const response = await sink.handle(insightRequest(body, options));
  expect(response.status).toBe(204);
  return PORTFOLIO_INSIGHTS.writeDataPoint.mock.calls[0]?.[0]?.blobs as string[] | undefined;
}

describe("parsePortfolioInsightPayload", () => {
  it("accepts the shape the client adapter already validates", () => {
    expect(
      parsePortfolioInsightPayload({
        action: "content_open",
        dimensions: { content_id: "record-9q", content_kind: "record", selection_source: "map" },
        session_id: "0b7c1e52-4c4b-4d0e-9a53-6f1f0f7f2d11",
      }),
    ).toEqual({
      action: "content_open",
      dimensions: { content_id: "record-9q", content_kind: "record", selection_source: "map" },
      session_id: "0b7c1e52-4c4b-4d0e-9a53-6f1f0f7f2d11",
    });
    expect(parsePortfolioInsightPayload({ action: "entry" })).toEqual({
      action: "entry",
      dimensions: {},
      session_id: "",
    });
  });

  it("drops an event whose session id is malformed or oversized", () => {
    for (const session_id of [
      "short",
      "x".repeat(129),
      "-leading-hyphen",
      "alice@example.com",
      "session a",
      42,
      null,
    ]) {
      expect(parsePortfolioInsightPayload({ action: "entry", session_id })).toBeNull();
    }
    expect(
      parsePortfolioInsightPayload({ action: "entry", session_id: "x".repeat(128) })?.session_id,
    ).toBe("x".repeat(128));
  });

  it("rejects anything that could carry personal content", () => {
    expect(parsePortfolioInsightPayload(null)).toBeNull();
    expect(parsePortfolioInsightPayload("entry")).toBeNull();
    expect(parsePortfolioInsightPayload({ action: "Email alice@example.com" })).toBeNull();
    expect(
      parsePortfolioInsightPayload({ action: "entry", dimensions: { contact: "alice@example.com" } }),
    ).toBeNull();
    expect(
      parsePortfolioInsightPayload({ action: "entry", dimensions: { "Content-Id": "x" } }),
    ).toBeNull();
    expect(
      parsePortfolioInsightPayload({ action: "entry", dimensions: { content_id: 9 } }),
    ).toBeNull();
    expect(
      parsePortfolioInsightPayload({ action: "entry", dimensions: ["content_id"] }),
    ).toBeNull();
    expect(
      parsePortfolioInsightPayload({ action: "entry", dimensions: { content_id: "x".repeat(129) } }),
    ).toBeNull();
  });

  it("caps the dimension count", () => {
    const dimensions = Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [`d${index}`, "v"]),
    );
    expect(parsePortfolioInsightPayload({ action: "entry", dimensions })).toBeNull();
    delete dimensions.d8;
    expect(parsePortfolioInsightPayload({ action: "entry", dimensions })).not.toBeNull();
  });
});

describe("deviceClassFromUserAgent", () => {
  it("keeps only a coarse class of the user agent", () => {
    expect(deviceClassFromUserAgent(null)).toBe("unknown");
    expect(deviceClassFromUserAgent("")).toBe("unknown");
    expect(
      deviceClassFromUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("mobile");
    expect(
      deviceClassFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15"),
    ).toBe("tablet");
    expect(
      deviceClassFromUserAgent("Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 Safari/537.36"),
    ).toBe("tablet");
    expect(
      deviceClassFromUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36"),
    ).toBe("mobile");
    expect(
      deviceClassFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/128 Safari/537.36"),
    ).toBe("desktop");
  });
});

describe("insightDataPoint", () => {
  it("lays the safe dimensions out in fixed blob positions", () => {
    expect(
      insightDataPoint(
        {
          action: "guide_evidence",
          dimensions: {
            campaign: "a1b2c3d4e5f6",
            evidence_source: "guide",
            target_id: "record-9q",
            target_kind: "record",
          },
          session_id: "session-g",
        },
        { country: "NL", regionCode: "NH", city: "Amsterdam", metroCode: "", device: "desktop" },
      ),
    ).toEqual({
      blobs: [
        "guide_evidence",
        "",
        "",
        "a1b2c3d4e5f6",
        "",
        "guide",
        "record-9q",
        "record",
        "NL",
        "desktop",
        "v2",
        "session-g",
        "NH",
        "Amsterdam",
        "",
      ],
      doubles: [0, 0],
      indexes: ["guide_evidence"],
    });
  });

  it("carries attention numbers as doubles and never invents them", () => {
    const point = insightDataPoint(
      {
        action: "content_attention",
        dimensions: {
          active_seconds: "47",
          completion_percent: "63",
          content_id: "record-9q",
          content_kind: "record",
        },
        session_id: "",
      },
      { ...noGeography, device: "mobile" },
    );
    expect(point.blobs.slice(0, 3)).toEqual(["content_attention", "record-9q", "record"]);
    expect(point.doubles).toEqual([47, 63]);
    expect(
      insightDataPoint(
        { action: "content_attention", dimensions: { active_seconds: "lots" }, session_id: "" },
        { ...noGeography, device: "unknown" },
      ).doubles,
    ).toEqual([0, 0]);
  });

  it("drops dimensions the layout has no slot for", () => {
    const point = insightDataPoint(
      { action: "entry", dimensions: { entry_source: "campaign", mystery: "value" }, session_id: "" },
      { ...noGeography, country: "GB", device: "desktop" },
    );
    expect(point.blobs).not.toContain("value");
    expect(point.blobs[5]).toBe("campaign");
  });
});

describe("insightSinkActive", () => {
  it("is off unless the variable names the sink and the binding exists", () => {
    expect(insightSinkActive({})).toBe(false);
    expect(insightSinkActive({ PORTFOLIO_INSIGHT_EVENTS_SINK: "off", PORTFOLIO_INSIGHTS: dataset() })).toBe(false);
    expect(insightSinkActive({ PORTFOLIO_INSIGHT_EVENTS_SINK: "true", PORTFOLIO_INSIGHTS: dataset() })).toBe(false);
    expect(insightSinkActive(activeEnv)).toBe(false);
    expect(insightSinkActive({ ...activeEnv, PORTFOLIO_INSIGHTS: dataset() })).toBe(true);
  });
});

describe("portfolio insight sink", () => {
  it("answers 204 and writes nothing while the gate is off", async () => {
    const PORTFOLIO_INSIGHTS = dataset();
    const sink = createPortfolioInsightSink({
      env: { PORTFOLIO_INSIGHT_EVENTS_SINK: "off", PORTFOLIO_INSIGHTS },
    });

    const response = await sink.handle(
      insightRequest({ action: "entry", dimensions: { entry_source: "direct" } }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(PORTFOLIO_INSIGHTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it("writes one data point per valid event, with only the approved geography from the edge", async () => {
    const PORTFOLIO_INSIGHTS = dataset();
    const sink = createPortfolioInsightSink({ env: { ...activeEnv, PORTFOLIO_INSIGHTS } });

    const response = await sink.handle(
      insightRequest(
        {
          action: "contact_action",
          dimensions: { contact_kind: "email", campaign: "a1b2c3d4e5f6" },
          session_id: "session-a",
        },
        {
          cf: {
            country: "DE",
            regionCode: "BE",
            city: "Berlin",
            metroCode: "27612",
            colo: "FRA",
            latitude: "52.52437",
            longitude: "13.41053",
            postalCode: "10115",
            asn: 64496,
            asOrganization: "Example Transit GmbH",
            timezone: "Europe/Berlin",
            mysteryProperty: "unknown-cf-value",
          },
          headers: {
            "cf-connecting-ip": "203.0.113.10",
            cookie: "portfolio_main_preview_session=secret",
            "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148",
          },
        },
      ),
    );

    expect(response.status).toBe(204);
    expect(PORTFOLIO_INSIGHTS.writeDataPoint).toHaveBeenCalledTimes(1);
    const point = PORTFOLIO_INSIGHTS.writeDataPoint.mock.calls[0][0];
    expect(point.blobs).toEqual([
      "contact_action", "", "", "a1b2c3d4e5f6", "email", "", "", "",
      "DE", "mobile", "v2", "session-a", "BE", "Berlin", "27612",
    ]);
    expect(point.doubles).toEqual([0, 0]);
    expect(point.indexes).toEqual(["contact_action"]);
    const serialized = JSON.stringify(point);
    for (const leak of [
      "203.0.113.10",
      "secret",
      "Mozilla",
      "iPhone",
      "FRA",
      "52.52437",
      "13.41053",
      "10115",
      "64496",
      "Example Transit",
      "Europe/Berlin",
      "unknown-cf-value",
    ]) {
      expect(serialized).not.toContain(leak);
    }
  });

  it("stores the geography only in its approved, bounded shape", async () => {
    const body = { action: "entry", session_id: "session-a" };
    const geographyOf = (blobs: string[] | undefined) => blobs?.slice(12, 15);

    expect(
      geographyOf(
        await writtenBlobs(body, {
          cf: { country: "BR", regionCode: "SP", city: "São Paulo", metroCode: "501" },
        }),
      ),
    ).toEqual(["SP", "São Paulo", "501"]);
    expect(
      geographyOf(
        await writtenBlobs(body, {
          cf: { country: "FR", regionCode: "NAQ", city: "Saint-Jean-d'Angély" },
        }),
      ),
    ).toEqual(["NAQ", "Saint-Jean-d'Angély", ""]);

    for (const cf of [
      { regionCode: "R".repeat(17), city: "C".repeat(97), metroCode: "1".repeat(17) },
      { regionCode: "B E", city: "Berlin<script>", metroCode: "50-1" },
      { regionCode: "BÉ", city: "", metroCode: "" },
      { regionCode: 12, city: ["Berlin"], metroCode: 501 },
      { regionCode: null, city: { name: "Berlin" }, metroCode: undefined },
    ]) {
      expect(geographyOf(await writtenBlobs(body, { cf }))).toEqual(["", "", ""]);
    }
    expect(
      geographyOf(await writtenBlobs(body, { cf: { regionCode: "R".repeat(16), metroCode: "Z".repeat(16) } })),
    ).toEqual(["R".repeat(16), "", "Z".repeat(16)]);
  });

  it("takes region, city, and metro only from request.cf, never from headers", async () => {
    const blobs = await writtenBlobs(
      { action: "entry", session_id: "session-a" },
      {
        headers: {
          "cf-ipcountry": "US",
          "cf-region-code": "CA",
          "cf-ipcity": "San Francisco",
          "cf-metro-code": "807",
        },
      },
    );
    expect(blobs?.[8]).toBe("US");
    expect(blobs?.slice(12, 15)).toEqual(["", "", ""]);
  });

  it("drops an event with a malformed session id and keeps one without any", async () => {
    expect(await writtenBlobs({ action: "entry", session_id: "bad id!" })).toBeUndefined();
    expect(await writtenBlobs({ action: "entry", session_id: "x".repeat(129) })).toBeUndefined();
    expect((await writtenBlobs({ action: "entry" }))?.[11]).toBe("");
  });

  it("accepts a sendBeacon body sent as text/plain and falls back to the country header", async () => {
    const PORTFOLIO_INSIGHTS = dataset();
    const sink = createPortfolioInsightSink({ env: { ...activeEnv, PORTFOLIO_INSIGHTS } });

    const response = await sink.handle(
      insightRequest(JSON.stringify({ action: "entry", dimensions: { entry_source: "direct" } }), {
        headers: { "cf-ipcountry": "FR" },
      }),
    );

    expect(response.status).toBe(204);
    expect(PORTFOLIO_INSIGHTS.writeDataPoint.mock.calls[0][0].blobs[8]).toBe("FR");
  });

  it("drops invalid, oversized, and non-JSON bodies without saying so", async () => {
    const PORTFOLIO_INSIGHTS = dataset();
    const sink = createPortfolioInsightSink({ env: { ...activeEnv, PORTFOLIO_INSIGHTS } });

    for (const body of [
      "not json",
      JSON.stringify({ action: "Email alice@example.com" }),
      JSON.stringify({ action: "entry", dimensions: { note: "x".repeat(MAX_INSIGHT_BODY_BYTES) } }),
    ]) {
      const response = await sink.handle(insightRequest(body));
      expect(response.status).toBe(204);
    }
    const oversized = await sink.handle(
      insightRequest("{}", { headers: { "content-length": String(MAX_INSIGHT_BODY_BYTES + 1) } }),
    );
    expect(oversized.status).toBe(204);
    expect(PORTFOLIO_INSIGHTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it("never lets a sink failure change the response", async () => {
    const sink = createPortfolioInsightSink({
      env: {
        ...activeEnv,
        PORTFOLIO_INSIGHTS: {
          writeDataPoint: () => {
            throw new Error("dataset unavailable");
          },
        },
      },
    });
    const response = await sink.handle(insightRequest({ action: "entry" }));
    expect(response.status).toBe(204);
  });

  it("throttles by a hashed connecting address when a limiter is bound", async () => {
    const PORTFOLIO_INSIGHTS = dataset();
    const limit = vi
      .fn<(input: { key: string }) => Promise<{ success: boolean }>>()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });
    const sink = createPortfolioInsightSink({
      env: { ...activeEnv, PORTFOLIO_INSIGHTS, PORTFOLIO_INSIGHT_RATE_LIMITER: { limit } },
    });
    const request = () =>
      insightRequest({ action: "entry" }, { headers: { "cf-connecting-ip": "203.0.113.10" } });

    expect((await sink.handle(request())).status).toBe(204);
    expect((await sink.handle(request())).status).toBe(204);

    expect(PORTFOLIO_INSIGHTS.writeDataPoint).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledTimes(2);
    const key = limit.mock.calls[0][0].key;
    expect(key).toMatch(/^portfolio-insight:[a-f0-9]{32}$/u);
    expect(key).not.toContain("203.0.113.10");
  });

  it("keeps recording when the limiter itself fails", async () => {
    const PORTFOLIO_INSIGHTS = dataset();
    const sink = createPortfolioInsightSink({
      env: {
        ...activeEnv,
        PORTFOLIO_INSIGHTS,
        PORTFOLIO_INSIGHT_RATE_LIMITER: { limit: () => Promise.reject(new Error("down")) },
      },
    });
    const response = await sink.handle(
      insightRequest({ action: "entry" }, { headers: { "cf-connecting-ip": "203.0.113.10" } }),
    );
    expect(response.status).toBe(204);
    expect(PORTFOLIO_INSIGHTS.writeDataPoint).toHaveBeenCalledTimes(1);
  });

  it("only takes POST", async () => {
    const PORTFOLIO_INSIGHTS = dataset();
    const sink = createPortfolioInsightSink({ env: { ...activeEnv, PORTFOLIO_INSIGHTS } });
    const response = await sink.handle(
      new Request("https://bradleyberkman.com/api/portfolio-insight"),
    );
    expect(response.status).toBe(405);
    expect(PORTFOLIO_INSIGHTS.writeDataPoint).not.toHaveBeenCalled();
  });
});
