// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  PUBLIC_CLARITY_PROJECT_ID,
  setPrivacySafeReplayConsent,
  startPrivacySafeReplay,
} from "./portfolio-analytics";

afterEach(() => {
  document.head.innerHTML = "";
  delete window.clarity;
});

describe("privacy-safe portfolio replay", () => {
  it("uses the configured public Clarity project", () => {
    expect(PUBLIC_CLARITY_PROJECT_ID).toBe("yatoiqtrjm");
  });

  it("stays dormant away from the public portfolio domains", () => {
    expect(
      startPrivacySafeReplay({
        hostname: "localhost",
        projectId: "abc123",
      }),
    ).toBe(false);
    expect(document.querySelector("script[data-portfolio-replay]")).toBeNull();
  });

  it("loads Clarity once for every public visit without fabricating a consent signal", () => {
    expect(
      startPrivacySafeReplay({
        hostname: "bradleyberkman.com",
        projectId: "abc123",
      }),
    ).toBe(true);
    expect(
      startPrivacySafeReplay({
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

  it("rejects malformed project identifiers", () => {
    expect(
      startPrivacySafeReplay({
        hostname: "bradleyberkman.com",
        projectId: "abc123\" onload=\"alert(1)",
      }),
    ).toBe(false);
    expect(document.querySelector("script[data-portfolio-replay]")).toBeNull();
  });

  it("can disable or re-enable persistent anonymous analytics", () => {
    startPrivacySafeReplay({
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });

    expect(setPrivacySafeReplayConsent("denied")).toBe(true);
    expect(window.clarity?.q).toContainEqual([
      "consentv2",
      { ad_Storage: "denied", analytics_Storage: "denied" },
    ]);

    expect(setPrivacySafeReplayConsent("granted")).toBe(true);
    expect(window.clarity?.q?.at(-1)).toEqual([
      "consentv2",
      { ad_Storage: "denied", analytics_Storage: "granted" },
    ]);
  });
});
