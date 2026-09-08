"use client";

import { portfolioInterfaceText } from "../lib/portfolio-world";
import { useEffect, useState } from "react";
import {
  PUBLIC_CLARITY_PROJECT_ID,
  setPrivacySafeReplayConsent,
  startPrivacySafeReplay,
  trackPortfolioInsight,
} from "../lib/portfolio-analytics";

const CONSENT_KEY = "portfolio_analytics_consent";
const CAMPAIGN_KEY = "portfolio_analytics_campaign";
const OPAQUE_CAMPAIGN = /^[a-z0-9][a-z0-9_-]{5,63}$/u;

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
    let storedPreference: string | null = null;
    const url = new URL(window.location.href);
    const enrollOptOut = url.searchParams.get("analytics") === "off";
    const requestedCampaign = url.searchParams.get("campaign");
    if (enrollOptOut || requestedCampaign !== null) {
      url.searchParams.delete("analytics");
      url.searchParams.delete("campaign");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    let campaignCode: string | null = null;
    try {
      if (enrollOptOut) window.sessionStorage.removeItem(CAMPAIGN_KEY);
      const analyticsStorage = storage ?? window.localStorage;
      if (enrollOptOut) {
        analyticsStorage.setItem(CONSENT_KEY, "denied");
      }
      storedPreference = analyticsStorage.getItem(CONSENT_KEY);
      if (!enrollOptOut && requestedCampaign !== null) {
        if (OPAQUE_CAMPAIGN.test(requestedCampaign)) {
          window.sessionStorage.setItem(CAMPAIGN_KEY, requestedCampaign);
        } else {
          window.sessionStorage.removeItem(CAMPAIGN_KEY);
        }
      }
      campaignCode = window.sessionStorage.getItem(CAMPAIGN_KEY);
    } catch {
      // Analytics remains usable when browser storage is unavailable.
    }
    if (enrollOptOut || storedPreference === "denied") {
      setPrivacySafeReplayConsent("denied");
      return;
    }

    const enabled = startPrivacySafeReplay({
      campaignCode,
      context: document.documentElement.dataset.portfolioAnalyticsContext,
      hostname: hostname ?? window.location.hostname,
      projectId,
    });
    if (enabled) {
      // Re-enabling on an excluded page only writes the stored preference:
      // Clarity is not on that document, so there is nothing to consent to.
      // The next eligible load has to forward that saved `granted` itself,
      // otherwise the opt-in never reaches Clarity. An absent preference
      // stays absent — this must not fabricate a consent signal.
      if (storedPreference === "granted") {
        setPrivacySafeReplayConsent("granted");
      }
      trackPortfolioInsight("entry", {
        entry_source: campaignCode ? "campaign" : "direct",
      });
    }
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
      {optedOut
        ? portfolioInterfaceText["privacy.enableAnalytics"]
        : portfolioInterfaceText["privacy.optOutAnalytics"]}
    </button>
  );
}
