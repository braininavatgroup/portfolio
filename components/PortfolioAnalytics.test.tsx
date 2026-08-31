// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  PortfolioAnalytics,
  PortfolioAnalyticsPreference,
} from "./PortfolioAnalytics";

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
  it("starts analytics without rendering a persistent preference overlay", async () => {
    const storage = memoryStorage();
    render(
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        projectId="abc123"
        storage={storage}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(screen.queryByLabelText("Analytics preferences")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Opt out of analytics" }),
    ).toBeNull();
  });

  it("offers opt-out and re-enable controls on the privacy surface", async () => {
    const storage = memoryStorage();
    render(
      <>
        <PortfolioAnalytics
          hostname="bradleyberkman.com"
          projectId="abc123"
          storage={storage}
        />
        <PortfolioAnalyticsPreference storage={storage} />
      </>,
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
      <>
        <PortfolioAnalytics
          hostname="bradleyberkman.com"
          projectId="abc123"
          storage={storage}
        />
        <PortfolioAnalyticsPreference storage={storage} />
      </>,
    );

    await screen.findByRole("button", { name: "Enable anonymous analytics" });
    expect(window.clarity?.q?.at(-1)).toEqual([
      "consentv2",
      { ad_Storage: "denied", analytics_Storage: "denied" },
    ]);
  });
});
