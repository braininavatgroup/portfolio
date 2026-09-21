type ClarityQueue = ((...arguments_: unknown[]) => void) & {
  q?: unknown[][];
};

let insightEventsEnabled = false;
let insightCampaignCode: string | null = null;
let replayStarted = false;

declare global {
  interface Window {
    clarity?: ClarityQueue;
  }
}

type AttentionScroll = {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
};

type AttentionObservation = {
  activity?: boolean;
  focused?: boolean;
  now: number;
  scroll?: AttentionScroll;
  visible?: boolean;
};

export class PortfolioAttention {
  private activeMilliseconds = 0;
  private completionPercent = 0;
  private focused: boolean;
  private readonly idleAfterMilliseconds: number;
  private lastActivityAt: number;
  private lastObservedAt: number;
  private visible: boolean;

  constructor({
    focused = false,
    idleAfterMilliseconds = 30_000,
    now = 0,
    visible = false,
  }: {
    focused?: boolean;
    idleAfterMilliseconds?: number;
    now?: number;
    visible?: boolean;
  } = {}) {
    this.focused = focused;
    this.idleAfterMilliseconds = Math.max(0, idleAfterMilliseconds);
    this.lastActivityAt = now;
    this.lastObservedAt = now;
    this.visible = visible;
  }

  private accrue(now: number) {
    const observedAt = Math.max(now, this.lastObservedAt);
    if (this.visible && this.focused) {
      const activeUntil = Math.min(
        observedAt,
        this.lastActivityAt + this.idleAfterMilliseconds,
      );
      this.activeMilliseconds += Math.max(0, activeUntil - this.lastObservedAt);
    }
    this.lastObservedAt = observedAt;
    return observedAt;
  }

  observe({ activity, focused, now, scroll, visible }: AttentionObservation) {
    const observedAt = this.accrue(now);
    const resumed =
      (focused === true && !this.focused) ||
      (visible === true && !this.visible);

    if (focused !== undefined) this.focused = focused;
    if (visible !== undefined) this.visible = visible;
    if (activity || resumed) this.lastActivityAt = observedAt;

    if (scroll) {
      const scrollableHeight = scroll.scrollHeight - scroll.clientHeight;
      const completion = scrollableHeight <= 0
        ? 100
        : Math.round((scroll.scrollTop / scrollableHeight) * 100);
      this.completionPercent = Math.max(
        this.completionPercent,
        Math.min(100, Math.max(0, completion)),
      );
    }

    return {
      activeMilliseconds: this.activeMilliseconds,
      completionPercent: this.completionPercent,
    };
  }
}

export function trackPortfolioInsight(
  action: string,
  dimensions: Readonly<Record<string, string>> = {},
) {
  // One eligibility decision for both sinks: the same replay bootstrap and
  // consent state that gate Clarity gate the first-party post, so the worker
  // never hears from a visit Clarity would not.
  if (!insightEventsEnabled) return false;
  if (!/^[a-z][a-z0-9_]{0,63}$/u.test(action)) return false;

  const attributedDimensions = insightCampaignCode
    ? { ...dimensions, campaign: insightCampaignCode }
    : dimensions;
  const entries = Object.entries(attributedDimensions).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (entries.some(
    ([key, value]) =>
      !/^[a-z][a-z0-9_]{0,63}$/u.test(key) ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value),
  )) {
    return false;
  }

  if (window.clarity) {
    for (const [key, value] of entries) {
      window.clarity("set", `portfolio_${key}`, value);
    }
    window.clarity("event", `portfolio_${action}`);
  }
  postInsightEvent(action, Object.fromEntries(entries));
  return true;
}

const INSIGHT_SINK_PATH = "/api/portfolio-insight";
const TAB_SESSION_KEY = "biv_portfolio_insight_session_v1";
const TAB_SESSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/u;

type TabSessionStorage = Pick<Storage, "getItem" | "setItem">;

// Where storage refuses the write (private modes), the id lives only as long
// as this document, keyed by the storage it could not be written to.
const unpersistedTabSessionIds = new WeakMap<TabSessionStorage, string>();
// Stands in for `sessionStorage` when merely touching it throws.
const detachedTabValues = new Map<string, string>();
const detachedTabStorage: TabSessionStorage = {
  getItem: (key) => detachedTabValues.get(key) ?? null,
  setItem: (key, value) => {
    detachedTabValues.set(key, value);
  },
};

/**
 * One random, meaningless id per browser tab, so the sink can order a visit's
 * events into an anonymous journey. `sessionStorage` scopes it to the tab and
 * ends it with the tab; it is not a cookie and never identifies a returning
 * visitor. Only the first-party sink receives it — never Clarity.
 */
export function getPortfolioTabSessionId(
  storage: TabSessionStorage,
  makeId: () => string = () => crypto.randomUUID(),
) {
  const unpersisted = unpersistedTabSessionIds.get(storage);
  if (unpersisted) return unpersisted;
  try {
    const stored = storage.getItem(TAB_SESSION_KEY);
    if (stored !== null && TAB_SESSION_PATTERN.test(stored)) return stored;
  } catch {
    // Unreadable storage falls through to a fresh id held in memory.
  }
  const candidate = makeId();
  const id = TAB_SESSION_PATTERN.test(candidate) ? candidate : crypto.randomUUID();
  try {
    storage.setItem(TAB_SESSION_KEY, id);
  } catch {
    unpersistedTabSessionIds.set(storage, id);
  }
  return id;
}

function currentTabSessionId() {
  let storage: TabSessionStorage = detachedTabStorage;
  try {
    storage = window.sessionStorage;
  } catch {
    // Blocked storage throws on access; the detached store keeps the tab's id.
  }
  return getPortfolioTabSessionId(storage);
}

/**
 * The tab id to send with a Guide question, or undefined when this visit is
 * not eligible for insights. The worker keeps a chat transcript only for a
 * turn that carries one, so the same consent that gates Clarity and the sink
 * decides whether a conversation is kept.
 */
export function portfolioChatTranscriptSessionId() {
  if (!insightEventsEnabled) return undefined;
  try {
    return currentTabSessionId();
  } catch {
    return undefined;
  }
}

/**
 * Fire-and-forget copy of the event to the worker's own sink. A beacon
 * survives the page unloading, which is when the last attention snapshot is
 * sent; the keepalive fetch is the fallback where beacons are unavailable or
 * refused. The worker no-ops while its sink is off, and a failure here is
 * never allowed to reach the caller. The tab id is created here, and only
 * here, so an ineligible visit or a rejected event never writes one.
 */
function postInsightEvent(action: string, dimensions: Record<string, string>) {
  try {
    const body = JSON.stringify({ action, dimensions, session_id: currentTabSessionId() });
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(INSIGHT_SINK_PATH, body)) {
      return;
    }
    if (typeof fetch === "function") {
      void fetch(INSIGHT_SINK_PATH, {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body,
      }).catch(() => {});
    }
  } catch {
    // Telemetry never interrupts the page.
  }
}

export function trackPortfolioAttention(
  content: { contentId: string; contentKind: "record" | "thread" },
  snapshot: { activeMilliseconds: number; completionPercent: number },
) {
  return trackPortfolioInsight("content_attention", {
    active_seconds: String(Math.max(0, Math.floor(snapshot.activeMilliseconds / 1_000))),
    completion_percent: String(
      Math.min(100, Math.max(0, Math.round(snapshot.completionPercent))),
    ),
    content_id: content.contentId,
    content_kind: content.contentKind,
  });
}

const PUBLIC_PORTFOLIO_HOSTS = new Set([
  "bradleyberkman.com",
  "www.bradleyberkman.com",
]);

export const PUBLIC_CLARITY_PROJECT_ID = "yatoiqtrjm";

export function startPrivacySafeReplay({
  campaignCode,
  context,
  hostname,
  projectId,
}: {
  campaignCode?: string | null;
  context?: string;
  hostname: string;
  projectId?: string;
}) {
  insightEventsEnabled = false;
  insightCampaignCode = null;
  replayStarted = false;
  const normalizedProjectId = projectId?.trim();
  if (
    context !== "external" ||
    !PUBLIC_PORTFOLIO_HOSTS.has(hostname.toLowerCase()) ||
    !normalizedProjectId ||
    !/^[a-z0-9]+$/i.test(normalizedProjectId)
  ) {
    return false;
  }

  if (!window.clarity) {
    const clarity: ClarityQueue = (...arguments_) => {
      clarity.q ??= [];
      clarity.q.push(arguments_);
    };
    clarity.q = [];
    window.clarity = clarity;
  }

  if (!document.querySelector("script[data-portfolio-replay]")) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.portfolioReplay = "";
    script.src = `https://www.clarity.ms/tag/${normalizedProjectId}`;
    document.head.appendChild(script);
  }

  replayStarted = true;
  insightEventsEnabled = true;
  insightCampaignCode = campaignCode && /^[a-z0-9][a-z0-9_-]{5,63}$/u.test(campaignCode)
    ? campaignCode
    : null;
  return true;
}

export function setPrivacySafeReplayConsent(
  analyticsStorage: "granted" | "denied",
) {
  if (!window.clarity) return false;
  window.clarity("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: analyticsStorage,
  });
  insightEventsEnabled = analyticsStorage === "granted" && replayStarted;
  return true;
}
