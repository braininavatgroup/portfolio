// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ProjectIndex from "./page";

afterEach(cleanup);

describe("project index", () => {
  it("keeps domain titles while removing counts and numeric row prefixes", () => {
    const { container } = render(<ProjectIndex />);

    expect(screen.getByRole("heading", { name: "Music promotion" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Consulting" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Development" })).toBeTruthy();
    expect(container.querySelector(".domain-heading-meta")).toBeNull();
    expect(container.querySelector(".artifact-index-number")).toBeNull();
    expect(screen.queryByText(/\d+ projects/i)).toBeNull();
  });
});
