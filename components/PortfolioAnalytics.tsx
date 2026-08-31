"use client";

import { useEffect, useState } from "react";
import {
  PUBLIC_CLARITY_PROJECT_ID,
  setPrivacySafeReplayConsent,
  startPrivacySafeReplay,
} from "../lib/portfolio-analytics";

const CONSENT_KEY = "portfolio_analytics_consent";

type AnalyticsStorage = Pick<Storage, "getItem" | "setItem">;

export function PortfolioAnalytics({
  hostname,
  projectId = PUBLIC_CLARITY_PROJECT_ID,
  storage,
}: {
  hostname?: string;
  projectId?: string;
  storage?: AnalyticsStorage;
} = {}) {
  const [active, setActive] = useState(false);
  const [optedOut, setOptedOut] = useState(false);

  useEffect(() => {
    const enabled = startPrivacySafeReplay({
      hostname: hostname ?? window.location.hostname,
      projectId,
    });
    if (!enabled) return;

    let storedPreference: string | null = null;
    try {
      storedPreference = (storage ?? window.localStorage).getItem(CONSENT_KEY);
    } catch {
      // Analytics remains usable when browser storage is unavailable.
    }
    const denied = storedPreference === "denied";
    if (denied) setPrivacySafeReplayConsent("denied");
    const renderControl = window.setTimeout(() => {
      setOptedOut(denied);
      setActive(true);
    }, 0);
    return () => window.clearTimeout(renderControl);
  }, [hostname, projectId, storage]);

  const setPreference = (nextOptedOut: boolean) => {
    const preference = nextOptedOut ? "denied" : "granted";
    try {
      (storage ?? window.localStorage).setItem(CONSENT_KEY, preference);
    } catch {
      // Apply the in-memory preference even if persistence is unavailable.
    }
    setPrivacySafeReplayConsent(preference);
    setOptedOut(nextOptedOut);
  };

  if (!active) return null;

  return (
    <aside aria-label="Analytics preferences" className="portfolio-analytics-control">
      <a href="/privacy">Privacy</a>
      <span aria-hidden="true">·</span>
      <button onClick={() => setPreference(!optedOut)} type="button">
        {optedOut ? "Enable anonymous analytics" : "Opt out of analytics"}
      </button>
    </aside>
  );
}
