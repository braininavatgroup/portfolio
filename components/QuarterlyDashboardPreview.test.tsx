// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QuarterlyDashboardPreview } from "./QuarterlyDashboardPreview";

afterEach(cleanup);

describe("QuarterlyDashboardPreview", () => {
  it("embeds the working dashboard and links to its full-page route", () => {
    render(
      <QuarterlyDashboardPreview href="/demos/quarterly-dashboard" />,
    );

    const dashboard = screen.getByRole("region", {
      name: "Quarterly pitch conversion dashboard",
    });
    expect(
      within(dashboard).getByRole("navigation", { name: "Dashboard pages" }),
    ).not.toBeNull();
    expect(within(dashboard).getByRole("combobox", { name: "Year" })).not.toBeNull();
    expect(
      within(dashboard).getByRole("heading", {
        level: 2,
        name: "Ryan + Ryan Quarterly Pitch Conversion",
      }),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "Open full dashboard" }).getAttribute("href"),
    ).toBe("/demos/quarterly-dashboard");
  });
});
