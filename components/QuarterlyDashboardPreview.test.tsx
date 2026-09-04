// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QuarterlyDashboardPreview } from "./QuarterlyDashboardPreview";

afterEach(cleanup);

describe("QuarterlyDashboardPreview", () => {
  it("links a compact 2026 Q2 summary to the full dashboard", () => {
    render(
      <QuarterlyDashboardPreview
        href="/demos/quarterly-dashboard"
        label="Quarterly pitch conversion dashboard"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Explore the dashboard" }).getAttribute("href"),
    ).toBe("/demos/quarterly-dashboard");
    expect(screen.getByText("2026 Q2")).not.toBeNull();
    expect(screen.getByText("48", { selector: "strong" })).not.toBeNull();
    expect(screen.getByText("16", { selector: "strong" })).not.toBeNull();
    expect(screen.getByText("48.5%", { selector: "strong" })).not.toBeNull();
    expect(
      screen.getByRole("img", { name: "Eight-quarter pitch trend" }),
    ).not.toBeNull();
  });
});
