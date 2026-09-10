// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { portfolioWorldNodes } from "../lib/portfolio-world";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReaderCarousel } from "./ReaderCarousel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const assets = [
  {
    alt: "Adriatique — Electronic music duo",
    label: "Adriatique",
    links: { instagram: "https://www.instagram.com/adriatique/", spotify: "https://open.spotify.com/artist/02DWGcShQivFepRvGJ7xhB" },
    src: "/visuals/clients/adriatique.webp",
  },
  { alt: "Satori — Electronic music artist", label: "Satori", src: "/visuals/clients/satori.webp" },
  {
    alt: "Armada Music — Record Label",
    label: "Armada Music",
    links: { beatport: "https://www.beatport.com/label/armada-music/33099", instagram: "https://www.instagram.com/armadamusic/" },
    src: "/visuals/clients/armada.webp",
  },
];

describe("ReaderCarousel", () => {
  it("lets a tap or keyboard user focus a client to reveal its details", () => {
    render(<ReaderCarousel assets={assets} label="Clients" />);
    const trigger = screen.getByRole("button", { name: "Show details for Adriatique" });
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(trigger);
  });

  // Touch browsers do not focus a link on tap, so a card kept open by focus
  // alone vanishes before the platform link's click lands. A tapped card
  // stays open on its own until another opens or the visitor presses away.
  it("keeps a tapped card open without depending on focus", () => {
    render(<ReaderCarousel assets={assets} label="Clients" />);
    const trigger = screen.getByRole("button", { name: "Show details for Adriatique" });
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    const item = trigger.closest(".reader-carousel-item")!;
    expect(item.getAttribute("data-open")).toBe("true");

    fireEvent.blur(trigger);
    expect(item.getAttribute("data-open")).toBe("true");

    const link = screen.getByRole("link", { name: "Adriatique on Instagram" });
    fireEvent.pointerDown(link, { bubbles: true, pointerType: "touch" });
    expect(item.getAttribute("data-open")).toBe("true");

    const other = screen.getByRole("button", { name: "Show details for Armada Music" });
    fireEvent.pointerDown(other, { pointerType: "touch" });
    expect(item.getAttribute("data-open")).toBeNull();
    expect(other.closest(".reader-carousel-item")!.getAttribute("data-open")).toBe("true");

    fireEvent.pointerDown(document.body, { bubbles: true, pointerType: "touch" });
    expect(document.querySelector("[data-open='true']")).toBeNull();
  });

  // A mouse already reveals the card on hover; pinning it open on click would
  // leave cards up and the strip paused behind the visitor.
  it("leaves the mouse its hover-only card", () => {
    render(<ReaderCarousel assets={assets} label="Clients" />);
    const trigger = screen.getByRole("button", { name: "Show details for Adriatique" });
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector("[data-open='true']")).toBeNull();
  });

  it("publishes only absolute web addresses for client links", () => {
    const record = portfolioWorldNodes.find((node) => node.id === "music-practice")!;
    for (const block of record.body) {
      if (typeof block === "string" || block.type !== "visual") continue;
      for (const slide of block.slides ?? []) {
        for (const asset of slide.assets) {
          for (const href of Object.values(asset.links ?? {})) {
            expect(href, `${asset.label}: ${href}`).toMatch(/^https?:\/\//);
            expect(new URL(href).hostname).toBeTruthy();
          }
        }
      }
    }
  });

  it("renders every asset as a lazy image inside one labelled strip", () => {
    render(<ReaderCarousel assets={assets} label="Artists. Marquee clients." />);

    const strip = screen.getByRole("group", { name: "Artists. Marquee clients." });
    expect(strip.getAttribute("data-direction")).toBe("forward");
    expect(strip.getAttribute("data-motion")).toBe("auto");
    const images = strip.querySelectorAll("img");
    expect([...images].map((image) => image.getAttribute("alt"))).toEqual(
      assets.map((asset) => asset.alt),
    );
    expect([...images].every((image) => image.getAttribute("loading") === "lazy")).toBe(true);
    expect([...images].every((image) => image.getAttribute("draggable") === "false")).toBe(true);
    expect([...images].every(image => image.width === 128 && image.height === 128)).toBe(true);
    expect([...images].every(image => image.getAttribute("decoding") === "async")).toBe(true);
    expect(strip.querySelector(".reader-carousel-viewport")).toBeTruthy();
  });

  it("gives each mark a name and accessible icon links without a category row", () => {
    const { container } = render(<ReaderCarousel assets={assets} label="Artists" />);

    const items = container.querySelectorAll(".reader-carousel-item");
    const adriatique = items[0].querySelector(".reader-carousel-card")!;
    expect(adriatique.querySelector("strong")?.textContent).toBe("Adriatique");
    expect(adriatique.querySelector(":scope > span")).toBeNull();
    const links = [...adriatique.querySelectorAll("a")];
    expect(links.map((link) => link.getAttribute("aria-label"))).toEqual([
      "Adriatique on Instagram", "Adriatique on Spotify",
    ]);
    expect(links.every((link) => link.textContent === "" && link.querySelector("svg"))).toBe(true);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://www.instagram.com/adriatique/",
      "https://open.spotify.com/artist/02DWGcShQivFepRvGJ7xhB",
    ]);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
    expect(screen.getByRole("link", { name: "Adriatique on Instagram" })).toBe(links[0]);

    expect(
      [...items[2].querySelectorAll("a")].map((link) => link.getAttribute("aria-label")),
    ).toEqual(["Armada Music on Instagram", "Armada Music on Beatport"]);
    expect(items[1].querySelector(".reader-carousel-card strong")?.textContent).toBe("Satori");
    expect(items[1].querySelector(".reader-carousel-card-links")).toBeNull();
  });

  it("prefers Spotify and uses Beatport only when Spotify is absent", () => {
    const artist = {
      ...assets[0],
      links: { ...assets[0].links, beatport: "https://example.com/artist/beatport" },
    };
    const { rerender } = render(<ReaderCarousel assets={[artist]} label="Clients" />);
    expect(screen.getByRole("link", { name: "Adriatique on Spotify" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Adriatique on Beatport" })).toBeNull();

    rerender(<ReaderCarousel assets={[{ ...artist, links: { ...artist.links, spotify: undefined } }]} label="Clients" />);
    expect(screen.queryByRole("link", { name: "Adriatique on Spotify" })).toBeNull();
    expect(screen.getByRole("link", { name: "Adriatique on Beatport" }).getAttribute("href"))
      .toBe("https://example.com/artist/beatport");
    expect(screen.getByRole("link", { name: "Adriatique on Instagram" })).toBeTruthy();
  });

  it("runs the strip backward when asked", () => {
    render(<ReaderCarousel assets={assets} direction="backward" label="Labels" />);
    expect(screen.getByRole("group", { name: "Labels" }).getAttribute("data-direction")).toBe(
      "backward",
    );
  });

  it("keeps the strip still when the visitor prefers reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((media: string) => ({
      addEventListener() {},
      addListener() {},
      dispatchEvent: () => false,
      matches: media === "(prefers-reduced-motion: reduce)",
      media,
      onchange: null,
      removeEventListener() {},
      removeListener() {},
    }));

    render(<ReaderCarousel assets={assets} label="Artists" />);
    expect(screen.getByRole("group", { name: "Artists" }).getAttribute("data-motion")).toBe(
      "reduced",
    );
  });
});
