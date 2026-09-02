// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortfolioHeader } from "./PortfolioHeader";

afterEach(cleanup);

describe("PortfolioHeader", () => {
  it("renders the canonical index navigation", () => {
    render(<PortfolioHeader />);

    const navigation = screen.getByRole("navigation", {
      name: "Portfolio views",
    });
    expect(navigation).toBeTruthy();
    expect(screen.getByRole("link", { name: "Bradley Berkman" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Map" }).getAttribute("href")).toBe("/?view=graph");
  });
});
