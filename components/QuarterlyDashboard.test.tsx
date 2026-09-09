// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuarterlyDashboard } from "./QuarterlyDashboard";

afterEach(cleanup);

function getSelect(role: "combobox" | "listbox", name: string) {
  return screen.getByRole(role, { name }) as unknown as HTMLSelectElement;
}

describe("quarterly dashboard", () => {
  it("uses the complete dashboard as an embedded reader region", () => {
    render(<QuarterlyDashboard embedded />);

    const dashboard = screen.getByRole("region", {
      name: "Quarterly pitch conversion dashboard",
    });
    expect(dashboard.id).toBe("");
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Brokerage Pitch Conversion",
      }),
    ).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Dashboard pages" })).not.toBeNull();
    expect(getSelect("combobox", "Year").value).toBe("2026");
  });

  it("offers a canonical return to its portfolio case study", () => {
    render(
      <QuarterlyDashboard
        returnHref="/?view=graph#real-estate"
        returnLabel="Back to Real-estate deal tracker"
      />,
    );

    expect(
      screen
        .getByRole("link", { name: "Back to Real-estate deal tracker" })
        .getAttribute("href"),
    ).toBe("/?view=graph#real-estate");
  });

  it("opens on the 2026 Q2 summary", () => {
    render(<QuarterlyDashboard />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Brokerage Pitch Conversion",
      }),
    ).not.toBeNull();
    expect(getSelect("combobox", "Year").value).toBe("2026");
    expect(getSelect("combobox", "Quarter").value).toBe("Q2");
    expect(screen.getByRole("heading", { name: "Trend over time" })).not.toBeNull();
  });

  it("uses a trend point to change the selected period", async () => {
    const user = userEvent.setup();
    render(<QuarterlyDashboard />);

    await user.click(screen.getByRole("button", { name: "Show 2025 Q4" }));

    expect(getSelect("combobox", "Year").value).toBe("2025");
    expect(getSelect("combobox", "Quarter").value).toBe("Q4");
  });

  it("drills from signed exclusives into matching pitch detail", async () => {
    const user = userEvent.setup();
    render(<QuarterlyDashboard />);

    await user.click(screen.getByRole("button", { name: /Signed exclusives/ }));

    expect(screen.getByRole("heading", { name: "Pitch Detail" })).not.toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Signed exclusive", pressed: true })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.queryByText("Lost", { selector: "td" })).toBeNull();
  });

  it("cross-filters the summary from a competitor bar", async () => {
    const user = userEvent.setup();
    render(<QuarterlyDashboard />);

    await user.click(
      screen.getByRole("button", { name: "Show pitches lost to Compass" }),
    );

    expect(
      getSelect("combobox", "Lost to").value,
    ).toBe("Compass");
    expect(screen.getByRole("heading", { name: "Trend over time" })).not.toBeNull();
  });

  it("keeps filters when moving between summary and detail", async () => {
    const user = userEvent.setup();
    render(<QuarterlyDashboard />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Year" }), "2025");
    await user.selectOptions(screen.getByRole("combobox", { name: "Quarter" }), "Q3");
    await user.click(screen.getByRole("button", { name: "Pitch Detail" }));
    await user.click(screen.getByRole("button", { name: "Quarterly Summary" }));

    expect(getSelect("combobox", "Year").value).toBe("2025");
    expect(getSelect("combobox", "Quarter").value).toBe("Q3");
  });

  it("keeps the detail frame when filters have no matching pitches", async () => {
    const user = userEvent.setup();
    render(<QuarterlyDashboard />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Year" }), "2024");
    await user.selectOptions(screen.getByRole("combobox", { name: "Quarter" }), "Q1");
    await user.click(screen.getByRole("button", { name: "Pitch Detail" }));

    expect(screen.getByText("No pitches match the current filters.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Download CSV" })).not.toBeNull();
  });

  it("sends the current dashboard to the browser print dialog", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<QuarterlyDashboard />);

    await user.click(screen.getByRole("button", { name: "Print or save as PDF" }));

    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});
