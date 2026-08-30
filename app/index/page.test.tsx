// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ProjectIndex from "./page";

afterEach(cleanup);

describe("project index", () => {
  it("presents the portfolio sections in the shared editorial order", () => {
    const { container } = render(<ProjectIndex />);

    expect(
      [...container.querySelectorAll(".domain-section h2")].map(
        (heading) => heading.textContent,
      ),
    ).toEqual([
      "About",
      "Threads",
      "Operations",
      "Music promotions systems",
      "Client systems",
      "Personal systems",
      "In Production",
    ]);
  });

  it("lists threads and node groups without counts or numeric row prefixes", () => {
    const { container } = render(<ProjectIndex />);

    expect(screen.getByRole("heading", { name: "Threads" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Operations" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Music promotions systems" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "In Production" })).toBeTruthy();
    expect(container.querySelector(".domain-heading-meta")).toBeNull();
    expect(container.querySelector(".artifact-index-number")).toBeNull();
    expect(screen.queryByText(/\d+ projects/i)).toBeNull();
  });

  it("links every node row to its canonical page", () => {
    render(<ProjectIndex />);

    expect(
      screen
        .getByRole("link", { name: /Campaign pitching/ })
        .getAttribute("href"),
    ).toBe("/index/pitching");
    expect(
      screen
        .getByRole("link", { name: /Making work playable/ })
        .getAttribute("href"),
    ).toBe("/?view=graph#thread/making-work-playable");
  });
});
