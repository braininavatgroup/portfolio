// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PortfolioAnalytics,
  PortfolioAnalyticsPreference,
} from "./PortfolioAnalytics";

afterEach(() => {
  cleanup();
  document.head.innerHTML = "";
  delete document.documentElement.dataset.portfolioAnalyticsContext;
  delete window.clarity;
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

function markExternalVisit() {
  document.documentElement.dataset.portfolioAnalyticsContext = "external";
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("portfolio analytics consent", () => {
  it("keeps a password-preview document dormant on the public hostname", async () => {
    document.documentElement.dataset.portfolioAnalyticsContext = "preview";
    render(
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        projectId="abc123"
        storage={memoryStorage()}
      />,
    );
    await act(async () => {});

    expect(window.clarity).toBeUndefined();
    expect(document.querySelector("script[data-portfolio-replay]")).toBeNull();
  });

  it("starts analytics without rendering a persistent preference overlay", async () => {
    markExternalVisit();
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
      screen.queryByRole("button", { name: "Opt out of Clarity analytics" }),
    ).toBeNull();
  });

  it("offers opt-out and re-enable controls on the privacy surface", async () => {
    markExternalVisit();
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
      name: "Opt out of Clarity analytics",
    });
    expect(window.clarity?.q?.some((call) => call[0] === "consentv2")).toBe(false);

    fireEvent.click(optOut);

    expect(storage.getItem("portfolio_analytics_consent")).toBe("denied");
    expect(window.clarity?.q?.at(-1)).toEqual([
      "consentv2",
      { ad_Storage: "denied", analytics_Storage: "denied" },
    ]);
    expect(screen.getByRole("button", { name: "Enable Clarity analytics" })).toBeTruthy();
  });

  it("honors a stored opt-out before exposing the control", async () => {
    markExternalVisit();
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

    await screen.findByRole("button", { name: "Enable Clarity analytics" });
    expect(window.clarity).toBeUndefined();
    expect(document.querySelector("script[data-portfolio-replay]")).toBeNull();
  });

  it("forwards a saved opt-in to Clarity on the next eligible load", async () => {
    markExternalVisit();
    const storage = memoryStorage();
    storage.setItem("portfolio_analytics_consent", "denied");

    // The excluded load: Clarity never starts, so re-enabling can only write
    // the preference.
    const excluded = render(
      <>
        <PortfolioAnalytics
          hostname="bradleyberkman.com"
          projectId="abc123"
          storage={storage}
        />
        <PortfolioAnalyticsPreference storage={storage} />
      </>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Enable Clarity analytics" }),
    );
    expect(storage.getItem("portfolio_analytics_consent")).toBe("granted");
    expect(window.clarity).toBeUndefined();
    excluded.unmount();

    // The reload: Clarity starts and has to be told about the saved opt-in.
    render(
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        projectId="abc123"
        storage={storage}
      />,
    );
    await act(async () => {});

    expect(document.querySelector("script[data-portfolio-replay]")).toBeTruthy();
    expect(window.clarity?.q).toContainEqual([
      "consentv2",
      { ad_Storage: "denied", analytics_Storage: "granted" },
    ]);
    expect(window.clarity?.q?.findIndex((call) => call[0] === "consentv2")).toBeLessThan(
      window.clarity!.q!.findIndex(
        (call) => call[0] === "event" && call[1] === "portfolio_entry",
      ),
    );
  });

  it("keeps a saved opt-in dormant on a preview document", async () => {
    document.documentElement.dataset.portfolioAnalyticsContext = "preview";
    const storage = memoryStorage();
    storage.setItem("portfolio_analytics_consent", "granted");

    render(
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        projectId="abc123"
        storage={storage}
      />,
    );
    await act(async () => {});

    expect(window.clarity).toBeUndefined();
    expect(document.querySelector("script[data-portfolio-replay]")).toBeNull();
  });

  it("enrolls a personal browser before the first analytics bootstrap", async () => {
    markExternalVisit();
    window.history.replaceState({}, "", "/privacy?analytics=off#settings");
    window.sessionStorage.setItem("portfolio_analytics_campaign", "old-code");
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

    expect(storage.getItem("portfolio_analytics_consent")).toBe("denied");
    expect(window.sessionStorage.getItem("portfolio_analytics_campaign")).toBeNull();
    expect(window.location.pathname).toBe("/privacy");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#settings");
    expect(window.clarity).toBeUndefined();
    expect(document.querySelector("script[data-portfolio-replay]")).toBeNull();
  });

  it("keeps the current personal visit excluded when persistent storage is unavailable", async () => {
    markExternalVisit();
    window.history.replaceState({}, "", "/?analytics=off");
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    render(
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        projectId="abc123"
      />,
    );
    await act(async () => {});

    expect(window.location.search).toBe("");
    expect(window.clarity).toBeUndefined();
    expect(document.querySelector("script[data-portfolio-replay]")).toBeNull();
  });

  it("captures an opaque campaign before Clarity starts and removes it from the URL", async () => {
    markExternalVisit();
    window.history.replaceState(
      {},
      "",
      "/?campaign=search-7f2a&view=graph#case-study-47",
    );

    render(
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        projectId="abc123"
        storage={memoryStorage()}
      />,
    );

    await act(async () => {});

    expect(window.location.search).toBe("?view=graph");
    expect(window.location.hash).toBe("#case-study-47");
    expect(window.sessionStorage.getItem("portfolio_analytics_campaign")).toBe(
      "search-7f2a",
    );
    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_campaign",
      "search-7f2a",
    ]);
  });

  it("strips and discards a campaign value that could carry personal content", async () => {
    markExternalVisit();
    window.history.replaceState(
      {},
      "",
      "/?campaign=alice%40example.com&view=graph",
    );

    render(
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        projectId="abc123"
        storage={memoryStorage()}
      />,
    );

    await act(async () => {});

    expect(window.location.search).toBe("?view=graph");
    expect(window.sessionStorage.getItem("portfolio_analytics_campaign")).toBeNull();
    expect(
      window.clarity?.q?.some(
        (call) => call[0] === "set" && call[1] === "portfolio_campaign",
      ),
    ).toBe(false);
  });
});
