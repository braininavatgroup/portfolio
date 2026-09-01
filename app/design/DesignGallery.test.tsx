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

  it("makes every section a disclosure that starts open", () => {
    render(<DesignGallery />);

    const sections = [...document.querySelectorAll(".design-section")];
    expect(sections).toHaveLength(13);
    for (const section of sections) {
      expect(section.tagName).toBe("DETAILS");
      expect((section as HTMLDetailsElement).open).toBe(true);
      expect(section.querySelector(":scope > summary")).not.toBeNull();
    }
  });

  /**
   * A summary takes phrasing and heading content only, so the section note has
   * to be a span. A <p> there is invalid markup that browsers silently reparent
   * out of the summary, which would drop the note from a collapsed section.
   */
  it("keeps the collapsed note inside the summary as phrasing content", () => {
    render(<DesignGallery />);

    const summaries = [...document.querySelectorAll(".design-section-summary")];
    expect(summaries.length).toBeGreaterThan(0);
    for (const summary of summaries) {
      expect(summary.querySelector("p")).toBeNull();
      expect(summary.querySelector("h2")).not.toBeNull();
    }
  });

  /** Collapsing must not unmount a fixture someone has already mounted. */
  it("keeps a collapsed section's children in the DOM", async () => {
    const user = userEvent.setup();
    render(<DesignGallery />);

    const world = document.getElementById("world") as HTMLDetailsElement;
    await user.click(world.querySelector("summary")!);

    expect(world.open).toBe(false);
    expect(world.querySelectorAll(".portfolio-world").length).toBeGreaterThan(0);
  });

  it("reopens a collapsed section when the nav links to it", async () => {
    const user = userEvent.setup();
    render(<DesignGallery />);

    const world = document.getElementById("world") as HTMLDetailsElement;
    await user.click(world.querySelector("summary")!);
    expect(world.open).toBe(false);

    window.location.hash = "#world";
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(world.open).toBe(true);
    window.location.hash = "";
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

  /**
   * globals.css hides `.portfolio-composition > .portfolio-header`, because the
   * live composition only ever carries the overlay variant. Wrapping the
   * flow-layout states in the composition class therefore rendered four
   * invisible headers, and nothing in the DOM said so. The header's other real
   * surface is `/index`, which is `.flat-index`.
   */
  it("renders the flow-layout header on the surface that actually shows it", () => {
    render(<DesignGallery />);

    const flowHeaders = document.querySelectorAll(
      ".flat-index > .portfolio-header:not(.portfolio-header-overlay)",
    );
    expect(flowHeaders).toHaveLength(1);

    expect(
      document.querySelectorAll(".portfolio-composition > .portfolio-header"),
    ).toHaveLength(0);
  });

  /**
   * `/index` is hard-pinned to the light prototype palette. Without the pin the
   * gallery's dark mode rendered an `/index` header the live site never shows.
   */
  it("pins the index surface to light, as app/index/page.tsx does", () => {
    render(<DesignGallery />);

    const surface = document.querySelector(".flat-index");
    expect(surface?.getAttribute("data-theme")).toBe("light");
    expect(surface?.getAttribute("data-index-layout")).toBe("stacked-editorial");
  });

  /**
   * The state-matrix contract: one live tree per component, not one per state.
   * Before this the page carried five readers, four worlds and two chats.
   */
  it("mounts exactly one live instance of each composition component", () => {
    render(<DesignGallery />);

    expect(document.querySelectorAll(".portfolio-reader")).toHaveLength(1);
    expect(document.querySelectorAll(".portfolio-world")).toHaveLength(1);
    expect(document.querySelectorAll(".portfolio-header")).toHaveLength(1);
    expect(document.querySelectorAll(".portfolio-chat")).toHaveLength(1);
  });

  /**
   * `--reader-width` has two live values: clamp(460px, 38vw, 560px) and, below
   * 900px, 100%. The gallery used to force 100% on the reader and 0px on the
   * world, rendering a layout the site cannot produce.
   */
  it("never overrides the dossier width", () => {
    render(<DesignGallery />);

    const overridden = [...document.querySelectorAll<HTMLElement>("[style]")].filter(
      (node) => node.style.getPropertyValue("--reader-width") !== "",
    );

    expect(overridden.map((node) => node.className)).toEqual([]);
  });

  it("drives the reader through its states from one instance", async () => {
    const user = userEvent.setup();
    render(<DesignGallery />);

    expect(
      screen.getAllByRole("complementary", { name: /Portfolio index/ }),
    ).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Thread" }));

    expect(document.querySelectorAll(".portfolio-reader")).toHaveLength(1);
    expect(
      document.querySelector(".portfolio-reader")?.getAttribute("data-reader-mode"),
    ).toBe("thread");
  });

  /**
   * `.experience` carries `min-height: 100vh`, so one rendered outside a stage
   * claims a whole screen of empty page and pushes the rest of the gallery
   * below the fold. `.design-stage` is what bounds it. (A bare
   * `.portfolio-composition` without `.experience` is only borrowing tokens and
   * makes no viewport claim, so it does not need a stage.)
   */
  it("bounds every viewport-sized composition inside a stage", () => {
    render(<DesignGallery />);

    const unstaged = [...document.querySelectorAll(".experience")].filter(
      (node) => !node.closest(".design-stage"),
    );

    expect(unstaged.map((node) => node.className)).toEqual([]);
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
