// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QuarterlyDashboardPreview } from "./QuarterlyDashboardPreview";

afterEach(cleanup);

describe("QuarterlyDashboardPreview", () => {
  it("embeds the working dashboard", () => {
    render(
      <QuarterlyDashboardPreview />,
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
        name: "Brokerage Pitch Conversion",
      }),
    ).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Open full dashboard" })).toBeNull();
  });
});
