import { describe, expect, it } from "vitest";
import { QuarterlyDashboard } from "../../../components/QuarterlyDashboard";
import DashboardPage, { metadata } from "./page";

describe("quarterly dashboard route", () => {
  it("renders the interactive dashboard with portfolio metadata", () => {
    const page = DashboardPage();

    expect(page.type).toBe(QuarterlyDashboard);
    expect(page.props).toMatchObject({
      returnHref: "/?view=graph#real-estate",
      returnLabel: "Real-Estate Deal Tracker",
    });
    expect(metadata.title).toBe("Quarterly pitch conversion | Bradley Berkman");
    expect(metadata.description).toContain("interactive quarterly pitch-conversion dashboard");
  });
});
