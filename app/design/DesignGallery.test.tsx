// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { portfolioControlMarkKinds } from "../../lib/portfolio-control-mark";
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
      "reading-room",
      "reader",
      "world",
      "chat",
      "cursor",
      "analytics",
      "avatar",
      "composition",
    ]) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("shows the complete control set with SVG-brain patterns in Map and Guide", () => {
    render(<DesignGallery />);

    const controls = document.querySelectorAll("#marks .portfolio-control-mark");
    expect(controls).toHaveLength(portfolioControlMarkKinds.length);

    for (const kind of ["map", "chat"]) {
      const mark = document.querySelector(
        `#marks .portfolio-control-mark[data-control="${kind}"]`,
      )!;
      const pattern = mark.querySelector<HTMLElement>('.portfolio-control-pattern[data-pattern="brain"]')!;

      expect(pattern).not.toBeNull();
      expect(pattern.style.getPropertyValue("--control-shape")).toContain(`/glyph-textures/${kind}.svg`);
    }

    expect(
      document
        .querySelector('#marks .portfolio-control-mark[data-control="chat"] svg > path')
        ?.getAttribute("stroke-width"),
    ).toBe("1.25");
  });

  /**
   * The nav is built from the same grouped list the page renders from, so this
   * asserts the two cannot come apart: every section on the page is reachable
   * from the nav, and every nav link points at a section that exists. Before
   * the grouping, the list was a second hand-maintained copy of the ids.
   */
  it("keeps the grouped nav and the rendered sections in step", () => {
    render(<DesignGallery />);

    const linked = [...document.querySelectorAll(".design-gallery-nav a")].map(
      (a) => a.getAttribute("href")?.slice(1),
    );
    const rendered = [...document.querySelectorAll(".design-section")].map(
      (section) => section.id,
    );

    expect(linked).toEqual(rendered);
    expect(
      [...document.querySelectorAll(".design-gallery-nav-heading")].map(
        (h) => h.textContent,
      ),
    ).toEqual(["Foundations", "Composition", "Ambient", "Whole"]);
  });

  it("makes every section a disclosure that starts open", () => {
    render(<DesignGallery />);

    const sections = [...document.querySelectorAll(".design-section")];
    expect(sections).toHaveLength(12);
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

    expect(screen.getAllByRole("button", { name: "Mount" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Unmount/ })).toBeNull();
  });

  it("renders the reader and the world eagerly, since neither needs WebGL", () => {
    render(<DesignGallery />);

    expect(
      screen.getAllByRole("complementary", { name: /Portfolio home/ }).length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelectorAll(".portfolio-world").length,
    ).toBeGreaterThan(0);
  });

  /**
   * The state-matrix contract: one live tree per component, not one per state.
   * Before this the page carried five readers, four worlds and two chats.
   */
  it("mounts exactly one live instance of each composition component", () => {
    render(<DesignGallery />);

    expect(document.querySelectorAll(".portfolio-reader")).toHaveLength(1);
    expect(document.querySelectorAll(".portfolio-world")).toHaveLength(1);
    expect(document.querySelectorAll(".portfolio-chat")).toHaveLength(1);
  });

  it("renders the Reading Room in a viewport-width stage", () => {
    render(<DesignGallery />);

    expect(document.querySelector(
      '.design-stage[data-bleed="true"][data-size="viewport"] .portfolio-reading-room',
    )).not.toBeNull();
  });

  it("drives the reader through its states from one instance", async () => {
    const user = userEvent.setup();
    render(<DesignGallery />);

    expect(
      screen.getAllByRole("complementary", { name: /Portfolio home/ }),
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

});
