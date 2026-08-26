// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortfolioHeader } from "./PortfolioHeader";

afterEach(cleanup);

describe("PortfolioHeader", () => {
  it("forwards the repository obstacle ref while retaining accessible navigation", () => {
    const obstacleRef = vi.fn();
    render(
      <PortfolioHeader
        activeView="map"
        obstacleRef={obstacleRef}
        overlay
      />,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Portfolio views",
    });
    expect(obstacleRef).toHaveBeenCalledWith(screen.getByRole("banner"));
    expect(navigation).toBeTruthy();
    expect(screen.getByRole("link", { name: "Bradley Berkman" })).toBeTruthy();
    expect(screen.getByText("Map").getAttribute("aria-current")).toBe("page");
  });
});
