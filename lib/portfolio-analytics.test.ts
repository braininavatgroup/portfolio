// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import * as portfolioAnalytics from "./portfolio-analytics";
import {
  getPortfolioTabSessionId,
  PortfolioAttention,
  PUBLIC_CLARITY_PROJECT_ID,
  setPrivacySafeReplayConsent,
  startPrivacySafeReplay,
  trackPortfolioAttention,
  trackPortfolioInsight,
} from "./portfolio-analytics";

const TAB_SESSION_KEY = "biv_portfolio_insight_session_v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

afterEach(() => {
  document.head.innerHTML = "";
  delete window.clarity;
  window.sessionStorage.clear();
});

describe("privacy-safe portfolio replay", () => {
  it("uses the configured public Clarity project", () => {
    expect(PUBLIC_CLARITY_PROJECT_ID).toBe("yatoiqtrjm");
  });

  it("stays dormant away from the public portfolio domains", () => {
    expect(
      startPrivacySafeReplay({
        context: "external",
        hostname: "localhost",
        projectId: "abc123",
      }),
    ).toBe(false);
    expect(document.querySelector("script[data-portfolio-replay]")).toBeNull();
  });

  it("loads Clarity once for every public visit without fabricating a consent signal", () => {
    expect(
      startPrivacySafeReplay({
        context: "external",
        hostname: "bradleyberkman.com",
        projectId: "abc123",
      }),
    ).toBe(true);
    expect(
      startPrivacySafeReplay({
        context: "external",
        hostname: "www.bradleyberkman.com",
        projectId: "abc123",
      }),
    ).toBe(true);

    const scripts = document.querySelectorAll("script[data-portfolio-replay]");
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe(
      "https://www.clarity.ms/tag/abc123",
    );
    expect(window.clarity?.q).toEqual([]);
  });

  it("stays dormant on the public hostname without an explicit external context", () => {
    expect(
      startPrivacySafeReplay({
        context: "preview",
        hostname: "bradleyberkman.com",
        projectId: "abc123",
      }),
    ).toBe(false);
    expect(document.querySelector("script[data-portfolio-replay]")).toBeNull();
    expect(window.clarity).toBeUndefined();
  });

  it("rejects malformed project identifiers", () => {
    expect(
      startPrivacySafeReplay({
        context: "external",
        hostname: "bradleyberkman.com",
        projectId: "abc123\" onload=\"alert(1)",
      }),
    ).toBe(false);
    expect(document.querySelector("script[data-portfolio-replay]")).toBeNull();
  });

  it("can disable or re-enable persistent anonymous analytics", () => {
    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });

    expect(setPrivacySafeReplayConsent("denied")).toBe(true);
    expect(window.clarity?.q).toContainEqual([
      "consentv2",
      { ad_Storage: "denied", analytics_Storage: "denied" },
    ]);
    expect(trackPortfolioInsight("sample_action", {
      content_id: "record-9q",
    })).toBe(false);

    expect(setPrivacySafeReplayConsent("granted")).toBe(true);
    expect(window.clarity?.q?.at(-1)).toEqual([
      "consentv2",
      { ad_Storage: "denied", analytics_Storage: "granted" },
    ]);
    expect(trackPortfolioInsight("sample_action", {
      content_id: "record-9q",
    })).toBe(true);
  });
});

describe("portfolio attention", () => {
  it("starts a deterministic attention observation", () => {
    const Attention = portfolioAnalytics.PortfolioAttention;
    const attention = new Attention();

    expect("observe" in attention).toBe(true);
    if (!("observe" in attention)) return;
    expect(
      (attention.observe as (input: { now: number }) => unknown)({ now: 0 }),
    ).toEqual({ activeMilliseconds: 0, completionPercent: 0 });
  });

  it("accrues time only while visible and focused", () => {
    const attention = new PortfolioAttention({
      focused: true,
      idleAfterMilliseconds: 30_000,
      now: 0,
      visible: true,
    });

    expect(attention.observe({ now: 1_000, visible: false })).toEqual({
      activeMilliseconds: 1_000,
      completionPercent: 0,
    });
    expect(attention.observe({ now: 8_000 })).toEqual({
      activeMilliseconds: 1_000,
      completionPercent: 0,
    });
    expect(attention.observe({ now: 9_000, visible: true })).toEqual({
      activeMilliseconds: 1_000,
      completionPercent: 0,
    });
    expect(attention.observe({ focused: false, now: 11_000 })).toEqual({
      activeMilliseconds: 3_000,
      completionPercent: 0,
    });
    expect(attention.observe({ now: 20_000 })).toEqual({
      activeMilliseconds: 3_000,
      completionPercent: 0,
    });
  });

  it("caps a delayed observation at the idle boundary and resumes on activity", () => {
    const attention = new PortfolioAttention({
      focused: true,
      idleAfterMilliseconds: 30_000,
      now: 0,
      visible: true,
    });

    expect(attention.observe({ now: 60_000 })).toEqual({
      activeMilliseconds: 30_000,
      completionPercent: 0,
    });
    expect(attention.observe({ activity: true, now: 60_000 })).toEqual({
      activeMilliseconds: 30_000,
      completionPercent: 0,
    });
    expect(attention.observe({ now: 65_000 })).toEqual({
      activeMilliseconds: 35_000,
      completionPercent: 0,
    });
  });

  it("measures maximum completion from the Reader scroll extent", () => {
    const attention = new PortfolioAttention({
      focused: true,
      idleAfterMilliseconds: 30_000,
      now: 0,
      visible: true,
    });

    expect(attention.observe({
      now: 0,
      scroll: { clientHeight: 100, scrollHeight: 1_100, scrollTop: 500 },
    }).completionPercent).toBe(50);
    expect(attention.observe({
      now: 0,
      scroll: { clientHeight: 100, scrollHeight: 1_100, scrollTop: 200 },
    }).completionPercent).toBe(50);
    expect(attention.observe({
      now: 0,
      scroll: { clientHeight: 100, scrollHeight: 1_100, scrollTop: 2_000 },
    }).completionPercent).toBe(100);
    expect(attention.observe({
      now: 0,
      scroll: { clientHeight: 100, scrollHeight: 100, scrollTop: 0 },
    }).completionPercent).toBe(100);
  });
});

describe("portfolio insight events", () => {
  it("provides one generic event adapter instead of a record registry", () => {
    expect("trackPortfolioInsight" in portfolioAnalytics).toBe(true);
  });

  it("sends arbitrary safe dimensions through Clarity tags", () => {
    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    window.clarity!.q = [];

    expect(trackPortfolioInsight("sample_action", {
      content_id: "case-study-47",
      selection_source: "reader",
    })).toBe(true);
    expect(window.clarity?.q).toEqual([
      ["set", "portfolio_content_id", "case-study-47"],
      ["set", "portfolio_selection_source", "reader"],
      ["event", "portfolio_sample_action"],
    ]);
  });

  it("reports attention for an arbitrary content identifier", () => {
    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    window.clarity!.q = [];

    expect(trackPortfolioAttention(
      { contentId: "record-9q", contentKind: "record" },
      { activeMilliseconds: 47_900, completionPercent: 63 },
    )).toBe(true);
    expect(window.clarity?.q).toEqual([
      ["set", "portfolio_active_seconds", "47"],
      ["set", "portfolio_completion_percent", "63"],
      ["set", "portfolio_content_id", "record-9q"],
      ["set", "portfolio_content_kind", "record"],
      ["event", "portfolio_content_attention"],
    ]);
  });

  it("rejects event data that could carry personal content", () => {
    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    window.clarity!.q = [];

    expect(trackPortfolioInsight("Email alice@example.com", {
      content_id: "case-study-47",
    })).toBe(false);
    expect(trackPortfolioInsight("sample_action", {
      contact: "alice@example.com",
    })).toBe(false);
    expect(window.clarity?.q).toEqual([]);
  });
});

describe("tab session identity", () => {
  it("reuses one random session id in a tab and changes it in another tab", () => {
    const tabA = createMemoryStorage();
    const tabB = createMemoryStorage();
    expect(getPortfolioTabSessionId(tabA, () => "session-a")).toBe("session-a");
    expect(getPortfolioTabSessionId(tabA, () => "unused")).toBe("session-a");
    expect(getPortfolioTabSessionId(tabB, () => "session-b")).toBe("session-b");
    expect(tabA.getItem(TAB_SESSION_KEY)).toBe("session-a");
  });

  it("replaces a malformed stored or generated id with a random UUID", () => {
    const tampered = createMemoryStorage();
    tampered.setItem(TAB_SESSION_KEY, "alice@example.com");
    const replaced = getPortfolioTabSessionId(tampered, () => "short");
    expect(replaced).toMatch(UUID);
    expect(tampered.getItem(TAB_SESSION_KEY)).toBe(replaced);

    expect(getPortfolioTabSessionId(createMemoryStorage(), () => "x".repeat(129))).toMatch(UUID);
    expect(getPortfolioTabSessionId(createMemoryStorage(), () => "-leading-hyphen")).toMatch(UUID);
  });

  it("keeps one id in memory when private mode rejects storage", () => {
    const refuse = () => {
      throw new DOMException("storage disabled", "SecurityError");
    };
    const blocked = { getItem: refuse, setItem: refuse };
    expect(getPortfolioTabSessionId(blocked, () => "session-private")).toBe("session-private");
    expect(getPortfolioTabSessionId(blocked, () => "unused")).toBe("session-private");

    const quotaFull = { getItem: () => null, setItem: refuse };
    expect(getPortfolioTabSessionId(quotaFull, () => "session-quota")).toBe("session-quota");
    expect(getPortfolioTabSessionId(quotaFull, () => "unused")).toBe("session-quota");
  });
});

describe("first-party insight sink", () => {
  const originalSendBeacon = Object.getOwnPropertyDescriptor(navigator, "sendBeacon");
  const originalFetch = window.fetch;

  function stubBeacon(result = true) {
    const sendBeacon = vi.fn(() => result);
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: sendBeacon });
    return sendBeacon;
  }

  function stubFetch() {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    window.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  afterEach(() => {
    if (originalSendBeacon) {
      Object.defineProperty(navigator, "sendBeacon", originalSendBeacon);
    } else {
      delete (navigator as { sendBeacon?: unknown }).sendBeacon;
    }
    window.fetch = originalFetch;
    setPrivacySafeReplayConsent("denied");
  });

  it("posts the same validated payload to the worker as a beacon", () => {
    const sendBeacon = stubBeacon();
    startPrivacySafeReplay({
      campaignCode: "a1b2c3d4e5f6",
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    window.sessionStorage.setItem(TAB_SESSION_KEY, "session-a");
    window.clarity!.q = [];

    expect(trackPortfolioInsight("content_open", {
      selection_source: "map",
      content_id: "record-9q",
    })).toBe(true);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [path, body] = sendBeacon.mock.calls[0] as unknown as [string, string];
    expect(path).toBe("/api/portfolio-insight");
    expect(JSON.parse(body)).toEqual({
      action: "content_open",
      dimensions: {
        campaign: "a1b2c3d4e5f6",
        content_id: "record-9q",
        selection_source: "map",
      },
      session_id: "session-a",
    });
    // The journey key is the sink's alone; Clarity never receives it as a tag.
    expect(JSON.stringify(window.clarity?.q)).not.toContain("session-a");
    expect(JSON.stringify(window.clarity?.q)).not.toContain("session_id");
  });

  it("creates the tab id on the first eligible event and reuses it", () => {
    const sendBeacon = stubBeacon();
    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });

    expect(window.sessionStorage.getItem(TAB_SESSION_KEY)).toBeNull();
    expect(trackPortfolioInsight("entry", { entry_source: "direct" })).toBe(true);
    expect(trackPortfolioInsight("content_open", { content_id: "record-9q" })).toBe(true);

    const [first, second] = sendBeacon.mock.calls.map(
      (call) => JSON.parse((call as unknown as [string, string])[1]).session_id,
    );
    expect(first).toMatch(UUID);
    expect(second).toBe(first);
    expect(window.sessionStorage.getItem(TAB_SESSION_KEY)).toBe(first);
  });

  it("creates no session and sends nothing when analytics is ineligible, denied, or the event is invalid", () => {
    const sendBeacon = stubBeacon();

    startPrivacySafeReplay({
      context: "preview",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    expect(trackPortfolioInsight("entry", { entry_source: "direct" })).toBe(false);

    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    setPrivacySafeReplayConsent("denied");
    expect(trackPortfolioInsight("entry", { entry_source: "direct" })).toBe(false);

    setPrivacySafeReplayConsent("granted");
    expect(trackPortfolioInsight("entry", { note: "alice@example.com" })).toBe(false);

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(TAB_SESSION_KEY)).toBeNull();
  });

  it("falls back to a keepalive fetch when beacons are unavailable or refused", () => {
    const fetchMock = stubFetch();
    delete (navigator as { sendBeacon?: unknown }).sendBeacon;
    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    window.sessionStorage.setItem(TAB_SESSION_KEY, "session-fetch");

    expect(trackPortfolioInsight("entry", { entry_source: "direct" })).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/portfolio-insight", expect.objectContaining({
      method: "POST",
      keepalive: true,
      body: JSON.stringify({
        action: "entry",
        dimensions: { entry_source: "direct" },
        session_id: "session-fetch",
      }),
    }));

    const refused = stubBeacon(false);
    expect(trackPortfolioInsight("entry", { entry_source: "direct" })).toBe(true);
    expect(refused).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fires exactly when Clarity would, and still fires when Clarity is absent", () => {
    const sendBeacon = stubBeacon();

    expect(trackPortfolioInsight("entry", { entry_source: "direct" })).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();

    startPrivacySafeReplay({
      context: "preview",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    expect(trackPortfolioInsight("entry", { entry_source: "direct" })).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();

    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    setPrivacySafeReplayConsent("denied");
    expect(trackPortfolioInsight("entry", { entry_source: "direct" })).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();

    setPrivacySafeReplayConsent("granted");
    delete window.clarity;
    expect(trackPortfolioInsight("entry", { entry_source: "direct" })).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("sends nothing for an invalid event and never throws", () => {
    const sendBeacon = vi.fn(() => {
      throw new Error("blocked");
    });
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: sendBeacon });
    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });

    expect(trackPortfolioInsight("entry", { note: "alice@example.com" })).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(() => trackPortfolioInsight("entry", { entry_source: "direct" })).not.toThrow();
  });
});

describe("portfolioChatTranscriptSessionId", () => {
  it("returns the tab id for an eligible visit and nothing for one that is not", () => {
    startPrivacySafeReplay({ context: "external", hostname: "bradleyberkman.com", projectId: "abc123" });
    const id = portfolioAnalytics.portfolioChatTranscriptSessionId();
    expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/u);

    startPrivacySafeReplay({ context: "preview", hostname: "bradleyberkman.com", projectId: "abc123" });
    expect(portfolioAnalytics.portfolioChatTranscriptSessionId()).toBeUndefined();
  });
});
