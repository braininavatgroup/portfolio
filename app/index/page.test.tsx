// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PortfolioIndex from "./page";

afterEach(cleanup);

describe("portfolio index", () => {
  it("presents the portfolio sections in the shared editorial order", () => {
    const { container } = render(<PortfolioIndex />);

    expect(
      [...container.querySelectorAll(".index-section h2")].map(
        (heading) => heading.textContent,
      ),
    ).toEqual([
      "About",
      "Threads",
      "Operations",
      "Music promotions systems",
      "Client systems",
      "In Production",
    ]);
  });

  it("lists threads and node groups without counts or numeric row prefixes", () => {
    render(<PortfolioIndex />);

    expect(screen.getByRole("heading", { name: "Threads" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Operations" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Music promotions systems" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "In Production" })).toBeTruthy();
    expect(screen.queryByText(/\d+ projects/i)).toBeNull();
  });

  it("links every node row into the map reader", () => {
    render(<PortfolioIndex />);

    expect(
      screen
        .getByRole("link", { name: /Music promo campaign pitching/ })
        .getAttribute("href"),
    ).toBe("/?view=graph#pitching");
    expect(
      screen
        .getByRole("link", { name: /Making work playable/ })
        .getAttribute("href"),
    ).toBe("/?view=graph#thread/making-work-playable");
  });
});
