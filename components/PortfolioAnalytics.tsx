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
  }, [hostname, projectId, storage]);

  return null;
}

export function PortfolioAnalyticsPreference({
  storage,
}: {
  storage?: AnalyticsStorage;
} = {}) {
  const [optedOut, setOptedOut] = useState<boolean | null>(null);

  useEffect(() => {
    const readPreference = window.setTimeout(() => {
      try {
        setOptedOut(
          (storage ?? window.localStorage).getItem(CONSENT_KEY) === "denied",
        );
      } catch {
        setOptedOut(false);
      }
    }, 0);
    return () => window.clearTimeout(readPreference);
  }, [storage]);

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

  return optedOut === null ? null : (
    <button onClick={() => setPreference(!optedOut)} type="button">
      {optedOut ? "Enable anonymous analytics" : "Opt out of analytics"}
    </button>
  );
}
