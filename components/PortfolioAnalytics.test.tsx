// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortfolioAnalytics } from "./PortfolioAnalytics";

afterEach(() => {
  cleanup();
  document.head.innerHTML = "";
  delete window.clarity;
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("portfolio analytics consent", () => {
  it("starts every visit with analytics on and offers an opt-out", async () => {
    const storage = memoryStorage();
    render(
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        projectId="abc123"
        storage={storage}
      />,
    );

    const optOut = await screen.findByRole("button", {
      name: "Opt out of analytics",
    });
    expect(window.clarity?.q).toEqual([]);

    fireEvent.click(optOut);

    expect(storage.getItem("portfolio_analytics_consent")).toBe("denied");
    expect(window.clarity?.q?.at(-1)).toEqual([
      "consentv2",
      { ad_Storage: "denied", analytics_Storage: "denied" },
    ]);
    expect(screen.getByRole("button", { name: "Enable anonymous analytics" })).toBeTruthy();
  });

  it("honors a stored opt-out before exposing the control", async () => {
    const storage = memoryStorage();
    storage.setItem("portfolio_analytics_consent", "denied");
    render(
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        projectId="abc123"
        storage={storage}
      />,
    );

    await screen.findByRole("button", { name: "Enable anonymous analytics" });
    expect(window.clarity?.q?.at(-1)).toEqual([
      "consentv2",
      { ad_Storage: "denied", analytics_Storage: "denied" },
    ]);
  });
});
