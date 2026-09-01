// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesignGallery } from "./DesignGallery";

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(cleanup);

describe("design gallery route", () => {
  it("renders in light mode and switches to dark through [data-theme]", async () => {
    const user = userEvent.setup();
    render(<DesignGallery />);

    const gallery = screen.getByRole("main");
    expect(gallery.getAttribute("data-theme")).toBe("light");

    await user.click(screen.getByRole("button", { name: "dark" }));
    expect(gallery.getAttribute("data-theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "light" }));
    expect(gallery.getAttribute("data-theme")).toBe("light");
  });

  it("shows the token sections and every component section", () => {
    render(<DesignGallery />);

    for (const id of [
      "tokens-color",
      "tokens-type",
      "tokens-spacing",
      "marks",
      "header",
      "reader",
      "world",
      "chat",
      "cursor",
      "analytics",
      "avatar",
      "toybox",
      "composition",
    ]) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("leaves every Three.js fixture unmounted until it is asked for", () => {
    render(<DesignGallery />);

    expect(screen.getAllByRole("button", { name: "Mount" })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Unmount/ })).toBeNull();
  });

  it("renders the reader and the world eagerly, since neither needs WebGL", () => {
    render(<DesignGallery />);

    expect(
      screen.getAllByRole("complementary", { name: /Portfolio index/ }).length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelectorAll(".portfolio-world").length,
    ).toBeGreaterThan(0);
  });

  it("mirrors the mode onto the toybox portal host", async () => {
    const user = userEvent.setup();
    const host = document.createElement("div");
    host.id = "avatar-toybox-root";
    document.body.appendChild(host);

    render(<DesignGallery />);
    expect(host.getAttribute("data-theme")).toBe("light");

    await user.click(screen.getByRole("button", { name: "dark" }));
    expect(host.getAttribute("data-theme")).toBe("dark");

    host.remove();
  });
});
