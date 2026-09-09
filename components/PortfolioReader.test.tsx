// @vitest-environment jsdom

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  portfolioContact,
  portfolioThreads,
  portfolioThreadById,
  portfolioVisualFormat,
  portfolioWorldNodeById,
  portfolioWorldNodes,
} from "../lib/portfolio-world";
import { startPrivacySafeReplay } from "../lib/portfolio-analytics";
import { inlineLinkTargets, stripInlineLinks } from "../lib/portfolio-inline-links";
import { paragraphHasList, parseParagraphFlow } from "../lib/portfolio-paragraph";
import { PortfolioReader } from "./PortfolioReader";
import * as reportEmbed from "../lib/portfolio-report-embed";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.head.innerHTML = "";
  delete window.clarity;
});

function enableAnalytics() {
  startPrivacySafeReplay({
    context: "external",
    hostname: "bradleyberkman.com",
    projectId: "abc123",
  });
  window.clarity!.q = [];
}

const baseProps = {
  activeThreadId: null,
  onReset: () => {},
  onSelect: () => {},
  onSelectThread: () => {},
  selectedId: null,
};

// Keep planned-state coverage independent of which portfolio visuals are finished.
function usePlannedGalleryFixture() {
  const getNode = portfolioWorldNodeById.get.bind(portfolioWorldNodeById);
  const purpose = "A gallery awaiting capture.";
  const node = {
    ...getNode("reporting")!,
    body: [{
      type: "visual" as const,
      id: "planned-gallery-fixture",
      status: "planned" as const,
      treatment: "sequence" as const,
      sourceStatus: "capture" as const,
      format: "gallery" as const,
      purpose,
    }],
  };
  vi.spyOn(portfolioWorldNodeById, "get").mockImplementation(
    (id) => id === "reporting" ? node : getNode(id),
  );
  return purpose;
}

function countWorkbenchBlocks(id: string) {
  const node = portfolioWorldNodeById.get(id)!;
  return (
    (node.summaryStatus === "placeholder" ? 1 : 0) +
    node.body.filter((block) => typeof block !== "string" &&
      (block.type === "copy-placeholder" || block.status !== "ready")).length
  );
}

describe("PortfolioReader", () => {
  it("reports active attention and nested Reader completion for an arbitrary record", async () => {
    vi.useFakeTimers();
    enableAnalytics();
    const node = portfolioWorldNodes.find(
      (candidate) => candidate.id !== "bradley" && candidate.outlineType !== "why",
    )!;
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId={node.id} />,
    );
    const scroll = container.querySelector<HTMLElement>(".reader-scroll")!;
    Object.defineProperties(scroll, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1_000 },
    });
    scroll.scrollTop = 400;

    window.dispatchEvent(new Event("focus"));
    fireEvent.scroll(scroll);
    await act(async () => vi.advanceTimersByTime(15_000));

    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_content_id",
      node.id,
    ]);
    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_active_seconds",
      "15",
    ]);
    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_completion_percent",
      "50",
    ]);
  });

  it("opens on the About record as home, titled by name with the throughline beneath", () => {
    const { container } = render(<PortfolioReader {...baseProps} />);

    const reader = screen.getByRole("complementary", { name: "Portfolio home" });
    expect(reader.getAttribute("data-reader-mode")).toBe("about");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Bradley Berkman");
    expect(container.querySelector(".reader-summary")?.textContent).toBe(
      portfolioWorldNodeById.get("bradley")!.summary,
    );
    expect(container.querySelector(".reader-kind")).toBeNull();
    expect(container.querySelector(".reader-topbar")).toBeNull();
    expect(
      container.querySelector(".reader-composed-body > p")?.textContent,
    ).toMatch(/^Hey, I'm Bradley\.$/);
    expect(container.querySelector(".reader-index-group")).toBeNull();
    expect(screen.getByRole("link", { name: portfolioContact.email })).toBeTruthy();
  });

  it("treats Bradley's own node as home, headed by his name without a topbar", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="bradley" />,
    );

    expect(screen.getByRole("complementary", { name: "Portfolio home" })).toBeTruthy();
    expect(container.querySelector(".reader-topbar")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Bradley Berkman" })).toBeTruthy();
  });

  it("links About's paragraphs to the practices, systems, products, and INFAMOUS in their registers", () => {
    const onSelect = vi.fn();
    const onSelectThread = vi.fn();
    render(<PortfolioReader {...baseProps} onSelect={onSelect} onSelectThread={onSelectThread} />);

    const links = screen.getAllByRole("link").filter((button) =>
      button.classList.contains("reader-inline-link"),
    );
    expect(links.map((link) => link.textContent)).toEqual([
      "music promotions",
      "systems and AI",
      "product studio",
      "Philosophy",
      "INFAMOUS PR",
      "kickoff",
      "pitching",
      "reporting",
      "work more playable",
      "deal-tracking dashboard",
      "tour-advancing suite",
      "Dubs",
      "Writ",
    ]);
    expect(links.map((link) => link.getAttribute("data-register"))).toEqual([
      "warm",
      "warm",
      "warm",
      "story",
      "warm",
      "bridge",
      "bridge",
      "bridge",
      "story",
      "bridge",
      "bridge",
      "cool",
      "cool",
    ]);
    expect(screen.queryByText(/\[|\]\(/)).toBeNull();

    links.forEach((link) => fireEvent.click(link));
    expect(onSelect.mock.calls.map(([node]) => node.id)).toEqual([
      "music-practice",
      "systems-consulting",
      "product-studio",
      "infamous",
      "kickoff",
      "pitching",
      "reporting",
      "real-estate",
      "touring",
      "dubs",
      "writ",
    ]);
    expect(onSelectThread.mock.calls.map(([id]) => id)).toEqual(["philosophy", "making-work-playable"]);
  });

  it("floats the selected image or glyph under a hovered or focused inline link", () => {
    const { container } = render(<PortfolioReader {...baseProps} />);
    const link = (name: string) =>
      screen.getAllByRole("link", { name }).find((button) =>
        button.classList.contains("reader-inline-link"),
      )!;
    const preview = () => container.querySelector<HTMLElement>(".reader-inline-link-preview");

    expect(preview()).toBeNull();
    fireEvent.mouseEnter(link("Dubs"));
    expect(preview()?.getAttribute("aria-hidden")).toBe("true");
    expect(preview()?.querySelector("img")?.getAttribute("src")).toBe("/visuals/dubs/lock-screen.png");
    expect(preview()?.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(preview()?.textContent).toBe("");
    expect(preview()?.tagName).toBe("SPAN");
    fireEvent.mouseLeave(link("Dubs"));
    expect(preview()).toBeNull();

    fireEvent.focus(link("kickoff"));
    expect(preview()?.querySelector("img")?.getAttribute("src")).toBe(
      "/visuals/campaign/campaign-kickoff-poster.png",
    );
    fireEvent.blur(link("kickoff"));
    expect(preview()).toBeNull();

    fireEvent.mouseEnter(link("INFAMOUS PR"));
    expect(preview()?.querySelector("img")?.getAttribute("src")).toBe(
      "/visuals/hover/infamous.svg",
    );
    fireEvent.mouseLeave(link("INFAMOUS PR"));
    // Themes have an explicit glyph even without a body visual.
    fireEvent.mouseEnter(link("Philosophy"));
    expect(preview()?.dataset.treatment).toBe("glyph");
    expect(preview()?.querySelector("img")?.getAttribute("src")).toBe("/visuals/hover/theme.svg");
  });

  it("draws every contact row as an index row with its own mark", () => {
    const { container } = render(<PortfolioReader {...baseProps} />);

    const rows = [...container.querySelectorAll(".reader-contact-row")];
    expect(rows).toHaveLength(5);
    expect(
      rows.map((row) => row.querySelector(".portfolio-node-mark")?.getAttribute("data-contact")),
    ).toEqual(["email", "cv", "linkedin", "github", "instagram"]);
    for (const row of rows) {
      expect(row.classList.contains("reader-index-row")).toBe(true);
      expect(row.querySelector("small")).toBeNull();
      expect(row.parentElement?.tagName).toBe("LI");
    }
  });

  it("reports a contact action by kind without sending its address", () => {
    enableAnalytics();
    const social = portfolioContact.socials[0]!;
    render(<PortfolioReader {...baseProps} />);

    fireEvent.click(screen.getByRole("link", { name: social.label }));

    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_contact_kind",
      social.key,
    ]);
    expect(JSON.stringify(window.clarity?.q)).not.toContain(social.href);
  });

  it("does not add a redundant alternate-index link inside the reader", () => {
    render(<PortfolioReader {...baseProps} />);

    expect(screen.queryByRole("link", { name: "View as list" })).toBeNull();
  });

  it("keeps the editorial copy on the Thread page", () => {
    const thread = portfolioThreads[0];
    const { container } = render(
      <PortfolioReader
        {...baseProps}
        activeThreadId={thread.id}
        selectedId={thread.nodeId}
      />,
    );

    expect(screen.getByText(thread.lede)).toBeTruthy();
    for (const block of thread.body) {
      if (typeof block !== "string") continue;
      for (const piece of stripInlineLinks(block).split("\n- ")) {
        expect(container.textContent).toContain(piece.replace(/^- /, "").trim());
      }
    }
  });

  it.each([
    ["philosophy", "thread-philosophy"],
  ])("renders the %s Theme with its reviewed summary", (activeThreadId, selectedId) => {
    render(
      <PortfolioReader
        {...baseProps}
        activeThreadId={activeThreadId}
        selectedId={selectedId}
      />,
    );

    expect(screen.queryByText("[Summary in progress]")).toBeNull();
    expect(screen.getByText(portfolioThreads.find((thread) => thread.id === activeThreadId)!.lede)).toBeTruthy();
  });

  it("uses one summary treatment at the start of every record", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="systems-consulting" />,
    );

    const node = portfolioWorldNodeById.get("systems-consulting")!;
    const title = screen.getByRole("heading", { level: 1, name: node.label });
    const summary = screen.getByText(node.summary);
    expect(screen.queryByText(node.kind)).toBeNull();
    expect(container.querySelector(".reader-kind")).toBeNull();
    expect(container.querySelector(".reader-path")).toBeNull();
    expect(
      title.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(summary.classList.contains("reader-summary")).toBe(true);
    expect(container.querySelectorAll(".reader-summary")).toHaveLength(1);
    for (const block of node.body) {
      if (typeof block === "string") {
        for (const piece of stripInlineLinks(block).replace(/ \(https?:[^)]+\)/g, "").split("\n- ")) {
          expect(container.textContent).toContain(piece.trim());
        }
      }
    }
    expect(screen.queryByText("Read the current case study")).toBeNull();
  });

  it("renders a paragraph's `- ` lines as a bulleted list in the body voice", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="systems-consulting" />,
    );

    const listed = portfolioWorldNodeById
      .get("systems-consulting")!
      .body.find((block) => typeof block === "string" && paragraphHasList(block)) as string;
    const flow = parseParagraphFlow(listed);
    const group = container.querySelector(".reader-composed-body > .reader-paragraph-group");
    expect(group?.querySelector("p")?.textContent).toBe(
      flow.find((run) => run.type === "prose")!.text,
    );
    const items = Array.from(group?.querySelectorAll("ul.reader-list > li") ?? []);
    expect(items.map((item) => item.textContent)).toEqual(
      flow.find((run) => run.type === "list")!.items,
    );
    expect(container.querySelector(".reader-composed-body > p > ul")).toBeNull();
  });

  it("renders an external link as an anchor that opens in a new tab", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="music-practice" />,
    );

    const external = portfolioWorldNodeById
      .get("music-practice")!
      .body.flatMap((block) => (typeof block === "string" ? inlineLinkTargets(block) : []))
      .find((target) => target.kind === "external");
    const anchor = container.querySelector<HTMLAnchorElement>(
      '.reader-composed-body a.reader-inline-link[data-external="true"]',
    );
    expect(external?.kind).toBe("external");
    expect(anchor?.getAttribute("href")).toBe(external && "href" in external ? external.href : "");
    expect(anchor?.textContent).not.toBe("");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(anchor?.getAttribute("data-external")).toBe("true");
    expect(anchor?.hasAttribute("data-register")).toBe(false);
    expect(screen.queryByText(/\]\(https?:/)).toBeNull();
  });

  it("reports an external evidence open without sending its URL or text", () => {
    const node = portfolioWorldNodes.find((candidate) =>
      candidate.body.some(
        (block) =>
          typeof block === "string" &&
          inlineLinkTargets(block).some((target) => target.kind === "external"),
      ),
    )!;
    const external = node.body
      .flatMap((block) => (typeof block === "string" ? inlineLinkTargets(block) : []))
      .find((target) => target.kind === "external")!;
    enableAnalytics();
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId={node.id} />,
    );

    fireEvent.click(
      container.querySelector<HTMLAnchorElement>(
        '.reader-composed-body a.reader-inline-link[data-external="true"]',
      )!,
    );

    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_content_id",
      node.id,
    ]);
    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_evidence_kind",
      "external",
    ]);
    expect(JSON.stringify(window.clarity?.q)).not.toContain(
      external.kind === "external" ? external.href : "",
    );
  });

  it("reports a visual open using its arbitrary content and evidence IDs", () => {
    const node = portfolioWorldNodes.find((candidate) =>
      candidate.body.some(
        (block) => typeof block !== "string" && block.type === "visual" && block.format === "gallery" && block.layout !== "carousel",
      ),
    )!;
    const visual = node.body.find(
      (block) => typeof block !== "string" && block.type === "visual" && block.format === "gallery" && block.layout !== "carousel",
    )!;
    if (typeof visual === "string" || visual.type !== "visual") {
      throw new Error("fixture has no visual");
    }
    enableAnalytics();
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId={node.id} />,
    );

    fireEvent.click(
      container.querySelector<HTMLButtonElement>(`[data-evidence-id="${visual.id}"]`)!,
    );

    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_content_id",
      node.id,
    ]);
    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_evidence_id",
      visual.id,
    ]);
    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_evidence_kind",
      portfolioVisualFormat(visual),
    ]);
  });

  it("keeps the framed loop inline and sends that video into native fullscreen", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const kickoff = portfolioWorldNodeById.get("kickoff")!;
    const visual = kickoff.body.find(
      (block) => typeof block !== "string" && block.type === "visual",
    );
    if (!visual || typeof visual === "string" || visual.type !== "visual") {
      throw new Error("kickoff has no video visual");
    }
    render(<PortfolioReader {...baseProps} selectedId="kickoff" />);
    const reader = screen.getByRole("complementary", {
      name: "Music Promo Campaign Kickoff record",
    });
    const trigger = screen.getByRole("button", {
      name: `Open video in reader: ${visual.purpose}`,
    });
    const inlineVideo = screen.getByLabelText(
      visual.alt ?? visual.purpose,
    ) as HTMLVideoElement;
    const inlineFigure = trigger.closest("figure")!;
    const screenAperture = inlineVideo.closest(".reader-device-screen");
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(inlineVideo, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });

    expect(inlineVideo.autoplay).toBe(true);
    expect(inlineVideo.loop).toBe(true);
    expect(inlineVideo.muted).toBe(true);
    expect(inlineVideo.controls).toBe(false);
    expect(trigger).not.toContain(inlineVideo);
    expect(screenAperture).toContain(inlineVideo);
    expect(inlineFigure).toContain(inlineVideo);
    expect(inlineFigure.getAttribute("data-media-surface")).toBe("floating");
    expect(inlineVideo.querySelectorAll("source")).toHaveLength(1);
    expect(inlineVideo.querySelector("source")?.getAttribute("src")).toBe(visual.src);
    expect(visual.muxPlaybackId).toBeUndefined();
    expect(
      inlineFigure.querySelector<HTMLImageElement>(".reader-device-frame")?.getAttribute("src"),
    ).toBe(visual.frameSrc);

    fireEvent.click(trigger);

    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledTimes(1));
    expect(reader).toContain(inlineVideo);
    expect(inlineVideo.controls).toBe(true);
    expect(screen.queryByRole("region", { name: /Video full screen:/ })).toBeNull();
    expect(document.querySelector(".portfolio-visual-stage")).toBeNull();

    await act(async () => document.dispatchEvent(new Event("fullscreenchange")));
    expect(inlineVideo.controls).toBe(false);
    expect(play).toHaveBeenCalled();
  });

  it("uses the iPhone native video fullscreen API when element fullscreen is unavailable", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const kickoff = portfolioWorldNodeById.get("kickoff")!;
    const visual = kickoff.body.find(
      (block) => typeof block !== "string" && block.type === "visual",
    );
    if (!visual || typeof visual === "string" || visual.type !== "visual") {
      throw new Error("kickoff has no video visual");
    }
    render(<PortfolioReader {...baseProps} selectedId="kickoff" />);
    const trigger = screen.getByRole("button", {
      name: `Open video in reader: ${visual.purpose}`,
    });
    const inlineVideo = screen.getByLabelText(
      visual.alt ?? visual.purpose,
    ) as HTMLVideoElement;
    expect(trigger).not.toContain(inlineVideo);
    const webkitEnterFullscreen = vi.fn();
    Object.defineProperties(inlineVideo, {
      requestFullscreen: { configurable: true, value: undefined },
      webkitEnterFullscreen: { configurable: true, value: webkitEnterFullscreen },
    });

    fireEvent.click(trigger);

    await waitFor(() => expect(webkitEnterFullscreen).toHaveBeenCalledTimes(1));
    expect(inlineVideo.controls).toBe(true);
    expect(screen.queryByRole("region", { name: /Video full screen:/ })).toBeNull();

    await act(async () => inlineVideo.dispatchEvent(new Event("webkitendfullscreen")));
    expect(inlineVideo.controls).toBe(false);
  });

  it("decodes an inline video only while it is visible in the Reader", () => {
    const kickoff = portfolioWorldNodeById.get("kickoff")!;
    const visual = kickoff.body.find(
      (block) => typeof block !== "string" && block.type === "visual",
    );
    if (!visual || typeof visual === "string" || visual.type !== "visual") {
      throw new Error("kickoff has no video visual");
    }
    let reportIntersection: IntersectionObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        reportIntersection = callback;
      }

      disconnect = disconnect;
      observe = observe;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "0px";
      thresholds = [0];
    });
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    render(<PortfolioReader {...baseProps} selectedId="kickoff" />);
    const inlineVideo = screen.getByLabelText(visual.alt ?? visual.purpose);

    expect(observe).toHaveBeenCalledWith(inlineVideo);
    act(() => reportIntersection?.([
      { isIntersecting: false, target: inlineVideo } as unknown as IntersectionObserverEntry,
    ], {} as IntersectionObserver));
    expect(pause).toHaveBeenCalled();

    act(() => reportIntersection?.([
      { isIntersecting: true, target: inlineVideo } as unknown as IntersectionObserverEntry,
    ], {} as IntersectionObserver));
    expect(play).toHaveBeenCalled();

    cleanup();
    expect(disconnect).toHaveBeenCalled();
  });

  it("composites the official Apple frame over the redacted video in every browser", () => {
    const kickoff = portfolioWorldNodeById.get("kickoff")!;
    const visual = kickoff.body.find(
      (block) => typeof block !== "string" && block.type === "visual",
    );
    if (!visual || typeof visual === "string" || visual.type !== "visual") {
      throw new Error("kickoff has no video visual");
    }

    render(<PortfolioReader {...baseProps} selectedId="kickoff" />);

    const video = screen.getByLabelText(visual.alt ?? visual.purpose);
    expect(video.querySelectorAll("source")).toHaveLength(1);
    expect(video.querySelector("source")?.getAttribute("src")).toBe(visual.src);
    expect(visual.muxPlaybackId).toBeUndefined();
    expect(document.querySelector(".reader-device-frame")).toBeTruthy();
  });

  it("opens gallery images over the Reader instead of the Map", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="dubs" />,
    );
    const reader = screen.getByRole("complementary", { name: "Dubs record" });

    fireEvent.click(screen.getAllByRole("button", {
      name: /Open gallery visual in reader:/,
    })[0]!);

    const overlay = screen.getByRole("dialog", { name: /Visual in reader:/ });
    expect(reader).toContain(overlay);
    expect(overlay.getAttribute("aria-modal")).toBe("true");
    expect(reader.querySelector(".reader-scroll")?.hasAttribute("inert")).toBe(true);
    expect(overlay.querySelector("img")).toBeTruthy();
    expect(overlay.getAttribute("data-media-surface")).toBe("floating");
    expect(
      [...container.querySelectorAll(".reader-visual-gallery figure")].every(
        (figure) => figure.getAttribute("data-media-surface") === "floating",
      ),
    ).toBe(true);
    expect(container.querySelector(".reader-visual-overlay")).toBe(overlay);
    expect(document.querySelector(".portfolio-visual-stage")).toBeNull();
    expect(within(overlay).getByText("Lock Screen controls")).toBeTruthy();
    expect(within(overlay).getByText("1 of 8")).toBeTruthy();

    fireEvent.click(within(overlay).getByRole("button", { name: "Next visual frame" }));
    expect(within(overlay).getByText("Read and listen")).toBeTruthy();
    expect(within(overlay).getByText("2 of 8")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close visual in reader" }));
    expect(reader.querySelector(".reader-scroll")?.hasAttribute("inert")).toBe(false);
  });

  it("keeps Reader context visible behind image overlays", async () => {
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const overlayRule = stylesheet.match(/\.reader-visual-overlay\s*\{([^}]*)\}/)?.[1];

    expect(overlayRule).toMatch(/backdrop-filter:\s*blur\(/);
    expect(overlayRule).toMatch(
      /background:\s*color-mix\(in srgb, var\(--reader-paper\).*transparent\)/,
    );
  });

  it("lets a fullscreen video leave the inline device-frame geometry", async () => {
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const fullscreenRule = stylesheet.match(
      /\.reader-device-screen\s*>\s*video:fullscreen\s*\{([^}]*)\}/,
    )?.[1];

    expect(fullscreenRule).toMatch(/height:\s*100%/);
    expect(fullscreenRule).toMatch(/cursor:\s*auto\s*!important/);
    expect(fullscreenRule).toMatch(/inset:\s*0/);
    expect(fullscreenRule).toMatch(/object-fit:\s*contain/);
    expect(fullscreenRule).toMatch(/width:\s*100%/);
  });

  it("trims the laptop's transparent canvas and contains the full video in its screen", async () => {
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const deviceRule = stylesheet.match(/\.reader-device-video\s*\{([^}]*)\}/)?.[1];
    const screenRule = stylesheet.match(
      /\.reader-device-screen\s*\{([^}]*)\}/,
    )?.[1];
    const videoRule = stylesheet.match(
      /\.reader-device-screen\s*>\s*video\s*\{([^}]*)\}/,
    )?.[1];
    const layerRule = stylesheet.match(
      /\.reader-visual-block \.reader-device-poster,\s*\.reader-visual-block \.reader-device-frame\s*\{([^}]*)\}/,
    )?.[1];

    expect(deviceRule).toMatch(/aspect-ratio:\s*3205 \/ 1942/);
    expect(deviceRule).toMatch(/overflow:\s*hidden/);
    expect(deviceRule).toMatch(/width:\s*100%/);
    expect(screenRule).toMatch(/height:\s*85\.684861%/);
    expect(screenRule).toMatch(/left:\s*10\.078003%/);
    expect(screenRule).toMatch(/overflow:\s*hidden/);
    expect(screenRule).toMatch(/top:\s*3\.141092%/);
    expect(screenRule).toMatch(/width:\s*79\.875195%/);
    expect(videoRule).toMatch(/height:\s*100%/);
    expect(videoRule).not.toMatch(/transform:\s*scale\(/);
    expect(videoRule).toMatch(/width:\s*100%/);
    expect(layerRule).toMatch(/height:\s*115\.345005%/);
    expect(layerRule).toMatch(/left:\s*-3\.026521%/);
    expect(layerRule).toMatch(/top:\s*-11\.68898%/);
    expect(layerRule).toMatch(/width:\s*106\.084243%/);
  });

  it("shows the full recording inline and preserves it in fullscreen", async () => {
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const fullscreenRule = stylesheet.match(
      /\.reader-device-screen\s*>\s*video:fullscreen\s*\{([^}]*)\}/,
    )?.[1];

    expect(stylesheet).not.toMatch(/transform:\s*scale\(1\.35\)/);
    expect(fullscreenRule).toMatch(/transform:\s*none/);
  });

  it("uses only three-up or one-big rows for every inline gallery", async () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="dubs" />,
    );
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const rowRule = stylesheet.match(/^\.reader-visual-slide-row\s*\{([^}]*)\}/m)?.[1];
    const singleRule = stylesheet.match(
      /\.reader-visual-slide-row\[data-asset-count="1"\]\s*\{([^}]*)\}/,
    )?.[1];
    const rowCounts = [...container.querySelectorAll(".reader-visual-slide-row")]
      .map((row) => row.querySelectorAll("img").length);

    expect(rowCounts).toEqual([3, 1, 3, 1]);
    expect(rowCounts.every((count) => count === 1 || count === 3)).toBe(true);
    expect(rowRule).toMatch(/grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(singleRule).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
  });

  it("centers image-overlay labels and navigation in one footer", async () => {
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const footerRule = stylesheet.match(/\.reader-visual-overlay-footer\s*\{([^}]*)\}/)?.[1];
    const captionRule = stylesheet.match(/\.reader-visual-overlay-caption\s*\{([^}]*)\}/)?.[1];
    const navigationRule = stylesheet.match(
      /\.reader-visual-overlay-navigation\s*\{([^}]*)\}/,
    )?.[1];

    expect(footerRule).toMatch(/justify-items:\s*center/);
    expect(captionRule).toMatch(/color:\s*var\(--ink\)/);
    expect(captionRule).toMatch(/font:\s*var\(--reader-type-secondary\) var\(--font-reader\)/);
    expect(captionRule).toMatch(/text-align:\s*center/);
    expect(navigationRule).toMatch(/font:\s*var\(--reader-type-caption\) var\(--font-reader\)/);
    expect(navigationRule).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  it("embeds the working dashboard without an empty planned visual", () => {
    render(<PortfolioReader {...baseProps} selectedId="real-estate" />);

    expect(screen.queryByRole("link", { name: "Open full dashboard" })).toBeNull();
    expect(
      screen.getByRole("region", { name: "Quarterly pitch conversion dashboard" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Dashboard pages" }),
    ).not.toBeNull();
    expect(screen.queryByText("Planned gallery")).toBeNull();
    expect(
      screen.queryByText(
        "Compare the six-tool, attention-carried deal process with the explicit stages, advancement conditions, owners, and Google-based MVP.",
      ),
    ).toBeNull();
  });

  it("renders unfinished copy and planned visuals as part of the working composition", () => {
    const thread = portfolioThreads.find(({ id }) => id === "making-work-playable")!;
    vi.spyOn(portfolioThreadById, "get").mockImplementation((id) =>
      id === thread.id
        ? { ...thread, body: [{ type: "copy-placeholder", id: "test-copy", prompt: "Write this section." }] }
        : portfolioThreads.find((candidate) => candidate.id === id),
    );
    const placeholderPage = render(
      <PortfolioReader
        {...baseProps}
        activeThreadId="making-work-playable"
        selectedId="thread-making-work-playable"
      />,
    );
    expect(screen.getAllByText("Copy in progress")).toHaveLength(1);
    for (const label of screen.getAllByText("Copy in progress")) {
      const placeholder = label.closest("aside")!;
      expect(placeholder.classList.contains("reader-text-placeholder")).toBe(true);
      expect(placeholder.classList.contains("reader-draft-placeholder")).toBe(false);
    }
    placeholderPage.unmount();

    const galleryPurpose = usePlannedGalleryFixture();
    render(
      <PortfolioReader {...baseProps} selectedId="reporting" />,
    );
    expect(
      screen.getByRole("button", {
        name: `Open gallery visual in reader: ${galleryPurpose}`,
      }),
    ).toBeTruthy();

    const visual = screen.getByRole("button", {
      name: `Open gallery visual in reader: ${galleryPurpose}`,
    });
    expect(visual.classList.contains("reader-visual-draft")).toBe(true);
    expect(visual.classList.contains("reader-text-placeholder")).toBe(false);
    expect(visual.querySelector(".reader-visual-placeholder")).toBeTruthy();
  });

  it.each([
    { id: "music-practice", count: 45, client: "Adriatique", spotify: "02DWGcShQivFepRvGJ7xhB" },
    { id: "infamous", count: 20, client: "Aluna", spotify: "5ITI6SEoUZMIXXkzCfr4oE" },
  ])("renders $id clients through the shared carousel with working profile links", ({ id, count, client, spotify }) => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId={id} />,
    );
    const node = portfolioWorldNodeById.get(id)!;
    const block = node.body.find(
      (candidate) =>
        typeof candidate !== "string" &&
        candidate.type === "visual" &&
        candidate.layout === "carousel",
    );
    if (!block || typeof block === "string" || block.type !== "visual") {
      throw new Error(`${id} has no carousel visual`);
    }

    const strips = screen.getAllByRole("group", { name: "Clients. Clients" });
    expect(strips).toHaveLength(block.slides!.length);
    expect(strips.map((strip) => strip.getAttribute("data-direction"))).toEqual(
      block.slides!.map((_, index) => (index % 2 === 0 ? "forward" : "backward")),
    );
    const images = container.querySelectorAll(".reader-visual-carousel img");
    expect(images).toHaveLength(
      block.slides!.reduce((count, slide) => count + slide.assets.length, 0),
    );
    expect(images).toHaveLength(count);
    expect([...images].every((image) => image.getAttribute("alt"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: `Show details for ${client}` }));
    expect(screen.getByRole("link", { name: `${client} on Spotify` }).getAttribute("href"))
      .toBe(`https://open.spotify.com/artist/${spotify}`);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("link", { name: `${client} on Beatport` })).toBeNull();
    if (id === "infamous") {
      for (const removed of ["Modapit", "ASHRR", "Ana Moura"]) {
        expect(screen.queryByRole("button", { name: `Show details for ${removed}` })).toBeNull();
      }
    }
    expect(
      [...container.querySelectorAll(".reader-visual-carousel")].every(
        (figure) => figure.getAttribute("data-media-surface") === "floating",
      ),
    ).toBe(true);
    for (const slide of block.slides!) {
      expect(screen.getByText(slide.title)).toBeTruthy();
    }
    expect(container.querySelector(".reader-visual-slide-row")).toBeNull();
    expect(screen.queryByRole("button", { name: /Open gallery visual in reader:/ })).toBeNull();
    expect(screen.queryByText("Planned gallery")).toBeNull();
  });

  it("shows every Dubs gallery moment as a separate reader visual", () => {
    render(<PortfolioReader {...baseProps} selectedId="dubs" />);

    const visuals = document.querySelectorAll(".reader-visual-gallery .reader-visual-trigger");
    expect(visuals).toHaveLength(3);
    expect([...visuals].map((visual) => visual.querySelectorAll("img").length)).toEqual([
      4,
      3,
      1,
    ]);
    expect(visuals[0].textContent).toContain("Catch the thought where it happens");
    expect(visuals[1].textContent).toContain("What accumulates");
    expect(visuals[2].textContent).toContain("Connect your agent");
    expect(document.querySelector(".reader-placeholder-frame")).toBeNull();
  });

  it("embeds the working Touring demo after the field-registry explanation", () => {
    const { container } = render(<PortfolioReader {...baseProps} selectedId="touring" />);
    expect(screen.getByRole("region", {name:"Tour advancing demo"})).not.toBeNull();
    expect(screen.queryByRole("link", {name:"Open full demo ↗︎"})).toBeNull();
    const flow = [...container.querySelectorAll(".reader-composed-body > *")];
    expect(flow[2].querySelector(".portfolio-touring")).not.toBeNull();
    expect(container.querySelector(".reader-visual-gallery")).toBeNull();
    fireEvent.click(screen.getByRole("button", {name:"Promoter"}));
    expect(screen.getByRole("button", {name:"Save advance"})).not.toBeNull();
  });

  it("opens each Dubs gallery group at that group's first image", () => {
    const block = portfolioWorldNodeById.get("dubs")!.body.find(
      (candidate) => typeof candidate !== "string" && candidate.type === "visual",
    );
    if (!block || typeof block === "string" || block.type !== "visual") {
      throw new Error("Dubs has no gallery visual");
    }
    const assets = block.slides!.flatMap((slide) => slide.assets);
    render(<PortfolioReader {...baseProps} selectedId="dubs" />);

    const groups = screen.getAllByRole("button", {
      name: /Open gallery visual in reader:/,
    });
    fireEvent.click(groups[1]);
    expect(screen.getByRole("dialog", { name: /Visual in reader:/ }).querySelector("img")?.getAttribute("src"))
      .toBe(assets[4].src);
    fireEvent.click(screen.getByRole("button", { name: "Close visual in reader" }));
    fireEvent.click(groups[2]);
    expect(screen.getByRole("dialog", { name: /Visual in reader:/ }).querySelector("img")?.getAttribute("src"))
      .toBe(assets[7].src);
  });

  // Why nodes render in thread mode, so only a record with an in-progress
  // summary exercises this treatment. It skips while the copy has none.
  const placeholderSummaryId = [...portfolioWorldNodeById.values()].find(
    (node) => node.summaryStatus === "placeholder" && node.outlineType !== "why",
  )?.id;
  it.skipIf(!placeholderSummaryId)("marks an in-progress summary as placeholder text", () => {
    render(<PortfolioReader {...baseProps} selectedId={placeholderSummaryId ?? null} />);

    const summary = screen.getByText("[Summary in progress]");
    expect(summary.classList.contains("reader-summary")).toBe(true);
    expect(summary.classList.contains("reader-text-placeholder")).toBe(true);
  });

  it("embeds the native report on its approved portfolio origins", () => {
    vi.spyOn(reportEmbed, "isCampaignReportEmbedOrigin").mockReturnValue(true);
    const { container } = render(<PortfolioReader {...baseProps} selectedId="reporting" />);
    const frame = screen.getByTitle("MAMA SAY campaign report");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("src")).toBe("https://campaignreports.braininavat.dance/z8tfDu1OWgy9wN/");
    expect(frame.getAttribute("sandbox")).toBe("allow-downloads allow-modals allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox");
    expect(frame.closest("button")).toBeNull();
    expect(container.querySelectorAll(".reader-visual-gallery img")).toHaveLength(2);
  });

  it("keeps the real dashboard capture available on other preview origins", () => {
    vi.spyOn(reportEmbed, "isCampaignReportEmbedOrigin").mockReturnValue(false);
    const { container } = render(<PortfolioReader {...baseProps} selectedId="reporting" />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByAltText(/Actual MAMA SAY campaign dashboard/).getAttribute("src")).toBe("/visuals/campaign/reporting-dashboard.png");
  });

  it("shows the reporting workflow directly, without a diagram or disclosure", () => {
    const { container } = render(<PortfolioReader {...baseProps} selectedId="reporting" />);
    const trigger = screen.getByRole("button", { name: /Open gallery visual in reader: The reporting workflow/ });
    expect(trigger.closest("details")).toBeNull();
    expect(trigger.querySelector("img")?.getAttribute("src")).toBe("/visuals/campaign/reporting-result-workflow.png");
    expect(container.querySelector('[data-format="diagram"]')).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog").querySelector("img")?.getAttribute("src")).toBe("/visuals/campaign/reporting-result-workflow.png");
  });

  it("reserves the drafts image dimensions before Safari evaluates lazy loading", async () => {
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const imageRule = stylesheet.match(
      /\.reader-visual-trigger\[data-evidence-id="reporting-email"\] \.reader-visual-slide-row img\s*\{([^}]*)\}/,
    )?.[1];
    const ratio = imageRule?.match(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/);
    // A zero-height image sits above the clipped row and never becomes visible
    // to Safari's lazy loader. Reserve its full intrinsic size, not the crop size.
    expect(ratio).not.toBeNull();
    const png = await readFile(resolve(process.cwd(), "public/visuals/campaign/reporting-drafts-2x.png"));
    expect(Number(ratio?.[1]) / Number(ratio?.[2])).toBe(
      png.readUInt32BE(16) / png.readUInt32BE(20),
    );
  });

  it("opens the report drafts screenshot and restores focus when closed", async () => {
    const { container } = render(<PortfolioReader {...baseProps} selectedId="reporting" />);
    const trigger = screen.getByRole("button", { name: /Open gallery visual in reader: Campaign report drafts/ });
    expect(container.querySelector('img[src="/visuals/campaign/reporting-drafts-2x.png"]')).not.toBeNull();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("/visuals/campaign/reporting-drafts-2x.png");
    expect(within(dialog).getByText("Campaign report drafts, September 8")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close visual in reader" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  // The report speaks for itself; the caption link that used to sit under it
  // read as chrome and was removed.
  it("shows the campaign report without a caption link out", () => {
    const { container } = render(<PortfolioReader {...baseProps} selectedId="reporting" />);
    const preview = container.querySelector(".reader-report-preview")!;
    expect(preview).not.toBeNull();
    expect(preview.querySelector("figcaption")).toBeNull();
    expect(preview.querySelector("a")).toBeNull();
  });

  it("opens image and gallery blocks through the same reader overlay", () => {
    const cases = [
      { id: "writ", format: "gallery" },
      { id: "dubs", format: "gallery" },
      { id: "reporting", format: "gallery" },
    ] as const;

    for (const { id, format } of cases) {
      const { unmount } = render(
        <PortfolioReader {...baseProps} selectedId={id} />,
      );
      const trigger = screen.getAllByRole("button", {
        name: /Open gallery visual in reader:/,
      })[0];
      expect(trigger.getAttribute("data-format")).toBe(format);
      fireEvent.click(trigger);
      expect(screen.getByRole("dialog", { name: /Visual in reader:/ })).toBeTruthy();
      unmount();
    }
  });

  it("hangs Writ panel captures from a live menu bar and leaves plain frames alone", () => {
    render(<PortfolioReader {...baseProps} selectedId="writ" />);
    const frames = document.querySelectorAll(".mac-panel-frame");
    const chromeAssets = portfolioWorldNodeById
      .get("writ")!
      .body.flatMap((block) =>
        typeof block !== "string" && block.type === "visual"
          ? (block.slides ?? []).flatMap((slide) => slide.assets)
          : [],
      );
    expect(chromeAssets.some((asset) => !asset.chrome)).toBe(true);
    expect(frames).toHaveLength(
      chromeAssets.filter((asset) => asset.chrome === "mac-menu-bar").length,
    );
    for (const frame of frames) {
      const bar = frame.querySelector(".mac-menu-bar");
      expect(bar).toBeTruthy();
      // The Writ icon is the pinned centre item and every side icon is decorative.
      expect(bar!.querySelector(".mac-menu-bar-center img")!.getAttribute("src")).toContain("/menu-bar/writ.png");
      expect(frame.querySelector(":scope > img")!.getAttribute("src")).toContain("/visuals/writ/");
    }
  });

  it("supports a clean review mode without maintaining separate content", () => {
    window.history.replaceState({}, "", "/?view=graph&review=clean#infamous");
    render(
      <PortfolioReader {...baseProps} selectedId="infamous" />,
    );

    const reader = screen.getByRole("complementary", {
      name: `${portfolioWorldNodeById.get("infamous")!.label} record`,
    });
    expect(reader.classList.contains("portfolio-reader-clean-review")).toBe(true);
    expect(
      reader.querySelectorAll(
        ".reader-text-placeholder, .reader-visual-draft",
      ),
    ).toHaveLength(countWorkbenchBlocks("infamous"));
    window.history.replaceState({}, "", "/");
  });

  it("shows contact details only on the Bradley record", () => {
    render(<PortfolioReader {...baseProps} selectedId="bradley" />);
    expect(
      screen.getByRole("link", { name: portfolioContact.email }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: portfolioContact.cv.label }),
    ).toBeTruthy();

    cleanup();
    render(<PortfolioReader {...baseProps} selectedId="dubs" />);
    expect(screen.queryByText(portfolioContact.email)).toBeNull();
  });

  it("keeps Privacy as its final in-flow line with no Index or Home footer", () => {
    const { container } = render(<PortfolioReader {...baseProps} />);

    const scroll = container.querySelector(".reader-scroll")!;
    expect(scroll.lastElementChild).toBe(screen.getByRole("link", { name: "Privacy" }));
    expect(container.querySelector(".portfolio-reader-footer")).toBeNull();
    expect(screen.queryByRole("button", { name: "Portfolio index" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Portfolio home" })).toBeNull();
  });

  it("opens each new About, record, or thread selection at the top", () => {
    const { container, rerender } = render(
      <PortfolioReader {...baseProps} selectedId="dubs" />,
    );
    const scroll = container.querySelector<HTMLElement>(".reader-scroll")!;
    scroll.scrollTop = 420;

    rerender(<PortfolioReader {...baseProps} selectedId="writ" />);
    expect(scroll.scrollTop).toBe(0);
    scroll.scrollTop = 300;

    rerender(
      <PortfolioReader
        {...baseProps}
        activeThreadId="philosophy"
        selectedId="thread-philosophy"
      />,
    );
    expect(scroll.scrollTop).toBe(0);
    scroll.scrollTop = 200;

    rerender(<PortfolioReader {...baseProps} />);
    expect(scroll.scrollTop).toBe(0);
  });

  it("bundles a record's threads and linked records under one Related label", () => {
    const onSelectThread = vi.fn();
    const { container } = render(
      <PortfolioReader
        {...baseProps}
        activeThreadId="philosophy"
        onSelectThread={onSelectThread}
        selectedId="pitching"
      />,
    );

    expect(screen.queryByRole("heading", { name: "Themes" })).toBeNull();
    expect(container.querySelector(".reader-path")).toBeNull();
    const sections = [...container.querySelectorAll(".reader-record-section")];
    const related = sections.find((section) => section.querySelector("h2")?.textContent === "Related")!;
    const rows = [...related.querySelectorAll(".reader-index-row")].map((row) => row.textContent);
    const containing = portfolioThreads
      .filter(({ members }) => members.includes("pitching"))
      .map(({ title }) => title);
    expect(containing.length).toBeGreaterThan(0);
    expect(rows.slice(0, containing.length)).toEqual(containing);
    expect(rows.length).toBeGreaterThan(containing.length);
    fireEvent.click(related.querySelectorAll(".reader-index-row")[0]);
    expect(onSelectThread).toHaveBeenCalledWith("making-work-playable");
  });

  it("draws a planned visual as a bare frame with its kind, source, and caption", () => {
    const purpose = usePlannedGalleryFixture();
    render(<PortfolioReader {...baseProps} selectedId="reporting" />);

    const trigger = screen.getByRole("button", {
      name: `Open gallery visual in reader: ${purpose}`,
    });
    const frame = trigger.querySelector(".reader-placeholder-frame")!;
    expect(frame.getAttribute("data-format")).toBe("gallery");
    expect(frame.querySelector(".reader-placeholder-label")?.textContent).toBe("Planned gallery");
    expect(frame.querySelector(".reader-placeholder-count")?.textContent).toBe("1 / 3");
    expect(frame.querySelector(".reader-placeholder-source")?.textContent).toMatch(/·/);
    expect(trigger.querySelector("figcaption strong")).toBeNull();
    expect(trigger.querySelector(".reader-placeholder-meta")).toBeNull();
    expect(trigger.querySelector("figcaption")?.textContent).toContain(purpose);
  });
});
