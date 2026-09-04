// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  portfolioContact,
  portfolioThreads,
  portfolioVisualFormat,
  portfolioWorldNodeById,
  portfolioWorldNodes,
} from "../lib/portfolio-world";
import { startPrivacySafeReplay } from "../lib/portfolio-analytics";
import { inlineLinkTargets, stripInlineLinks } from "../lib/portfolio-inline-links";
import { paragraphHasList, parseParagraphFlow } from "../lib/portfolio-paragraph";
import { PortfolioReader } from "./PortfolioReader";

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

// A planned visual's purpose text for a node, read from the content rather
// than pinned here, so the copy can keep changing without touching this file.
function plannedVisualPurpose(id: string, format: "image" | "video" | "gallery") {
  const node = portfolioWorldNodeById.get(id)!;
  const block = node.body.find(
    (candidate) =>
      typeof candidate !== "string" &&
      candidate.type === "visual" &&
      candidate.format === format,
  );
  if (!block || typeof block === "string" || block.type !== "visual") {
    throw new Error(`${id} has no planned ${format} visual`);
  }
  return block.purpose;
}

function countWorkbenchBlocks(id: string) {
  const node = portfolioWorldNodeById.get(id)!;
  return (
    (node.summaryStatus === "placeholder" ? 1 : 0) +
    node.body.filter((block) => typeof block !== "string").length
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

  it("opens on the About record as home, titled by its throughline", () => {
    const { container } = render(<PortfolioReader {...baseProps} />);

    const reader = screen.getByRole("complementary", { name: "Portfolio home" });
    expect(reader.getAttribute("data-reader-mode")).toBe("about");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      portfolioWorldNodeById.get("bradley")!.summary,
    );
    expect(container.querySelector(".reader-summary")).toBeNull();
    expect(container.querySelector(".reader-kind")).toBeNull();
    expect(container.querySelector(".reader-topbar")).toBeNull();
    expect(
      container.querySelector(".reader-composed-body > p")?.textContent,
    ).toMatch(/^Hey, I'm Bradley\. I run Brain in a Vat Group/);
    expect(container.querySelector(".reader-index-group")).toBeNull();
    expect(screen.getByRole("link", { name: portfolioContact.email })).toBeTruthy();
  });

  it("treats Bradley's own node as home rather than a titled record", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="bradley" />,
    );

    expect(screen.getByRole("complementary", { name: "Portfolio home" })).toBeTruthy();
    expect(container.querySelector(".reader-topbar")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Bradley Berkman" })).toBeNull();
  });

  it("links About's first sentence to the three practices in their register", () => {
    const onSelect = vi.fn();
    render(<PortfolioReader {...baseProps} onSelect={onSelect} />);

    const links = screen.getAllByRole("button").filter((button) =>
      button.classList.contains("reader-inline-link"),
    );
    expect(links.map((link) => link.textContent)).toEqual([
      "music promotions",
      "systems and AI",
      "software",
    ]);
    expect(links.map((link) => link.getAttribute("data-register"))).toEqual([
      "warm",
      "warm",
      "warm",
    ]);
    expect(screen.queryByText(/\[|\]\(/)).toBeNull();

    links.forEach((link) => fireEvent.click(link));
    expect(onSelect.mock.calls.map(([node]) => node.id)).toEqual([
      "music-practice",
      "systems-consulting",
      "product-studio",
    ]);
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
    render(
      <PortfolioReader
        {...baseProps}
        activeThreadId={thread.id}
        selectedId={thread.nodeId}
      />,
    );

    expect(screen.getByText(thread.lede)).toBeTruthy();
    for (const block of thread.body) {
      if (typeof block === "string") {
        expect(screen.getByText(block)).toBeTruthy();
      }
    }
  });

  it.each([
    ["authorship", "thread-authorship"],
    ["philosophy", "thread-philosophy"],
  ])("renders the %s Why as copy in progress", (activeThreadId, selectedId) => {
    render(
      <PortfolioReader
        {...baseProps}
        activeThreadId={activeThreadId}
        selectedId={selectedId}
      />,
    );

    expect(screen.getByText("Copy in progress")).toBeTruthy();
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
        expect(container.textContent).toContain(stripInlineLinks(block).replace(/ \(https?:[^)]+\)/g, ""));
      }
    }
    expect(screen.queryByText("Read the current case study")).toBeNull();
  });

  it("renders a paragraph's `- ` lines as a bulleted list in the body voice", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="music-practice" />,
    );

    const listed = portfolioWorldNodeById
      .get("music-practice")!
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
      ".reader-composed-body a.reader-inline-link",
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
        ".reader-composed-body a.reader-inline-link",
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
        (block) => typeof block !== "string" && block.type === "visual",
      ),
    )!;
    const visual = node.body.find(
      (block) => typeof block !== "string" && block.type === "visual",
    )!;
    if (typeof visual === "string" || visual.type !== "visual") {
      throw new Error("fixture has no visual");
    }
    enableAnalytics();
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId={node.id} />,
    );

    fireEvent.click(
      container.querySelector<HTMLButtonElement>(".reader-visual-trigger")!,
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

  it("loops a framed video inline and opens its raw recording over the full viewport", () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const kickoff = portfolioWorldNodeById.get("kickoff")!;
    const visual = kickoff.body.find(
      (block) => typeof block !== "string" && block.type === "visual",
    );
    if (!visual || typeof visual === "string" || visual.type !== "visual") {
      throw new Error("kickoff has no video visual");
    }
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="kickoff" />,
    );
    const reader = screen.getByRole("complementary", {
      name: "Music promo campaign kickoff record",
    });
    const trigger = screen.getByRole("button", {
      name: `Open video in reader: ${visual.purpose}`,
    });
    const inlineVideo = trigger.querySelector("video")!;

    expect(inlineVideo.autoplay).toBe(true);
    expect(inlineVideo.loop).toBe(true);
    expect(inlineVideo.muted).toBe(true);
    expect(inlineVideo.controls).toBe(false);
    expect(trigger.querySelector("[data-media-surface='floating']")).toBeTruthy();
    expect(inlineVideo.querySelectorAll("source")).toHaveLength(1);
    expect(inlineVideo.querySelector("source")?.getAttribute("src")).toBe(visual.src);
    expect(inlineVideo.querySelector("source")?.getAttribute("type")).toBe("video/mp4");
    expect(
      trigger.querySelector<HTMLImageElement>(".reader-device-frame")?.getAttribute("src"),
    ).toBe(visual.frameSrc);

    fireEvent.click(trigger);

    const overlay = screen.getByRole("region", { name: /Video full screen:/ });
    const rawVideo = overlay.querySelector("video")!;
    const inlineSources = [...inlineVideo.querySelectorAll("source")].map(
      (source) => source.getAttribute("src"),
    );
    expect(reader).not.toContain(overlay);
    expect(document.body).toContain(overlay);
    expect(rawVideo.autoplay).toBe(true);
    expect(rawVideo.controls).toBe(true);
    expect(inlineSources).toContain(rawVideo.getAttribute("src"));
    expect(pause).toHaveBeenCalled();
    expect(overlay.getAttribute("data-media-surface")).toBe("floating");
    expect(overlay.getAttribute("data-scope")).toBe("viewport");
    expect(container.querySelector(".reader-inline-video")).toContain(inlineVideo);
    expect(document.querySelector(".portfolio-visual-stage")).toBeNull();
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

  it("composites the official Apple frame over a standard video in every browser", () => {
    const kickoff = portfolioWorldNodeById.get("kickoff")!;
    const visual = kickoff.body.find(
      (block) => typeof block !== "string" && block.type === "visual",
    );
    if (!visual || typeof visual === "string" || visual.type !== "visual") {
      throw new Error("kickoff has no video visual");
    }

    render(<PortfolioReader {...baseProps} selectedId="kickoff" />);

    const source = screen.getByLabelText(visual.alt ?? visual.purpose).querySelector("source");
    expect(source?.getAttribute("src")).toBe(visual.src);
    expect(source?.getAttribute("type")).toBe("video/mp4");
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

    const overlay = screen.getByRole("region", { name: /Visual in reader:/ });
    expect(reader).toContain(overlay);
    expect(overlay.querySelector("img")).toBeTruthy();
    expect(overlay.getAttribute("data-media-surface")).toBe("floating");
    expect(
      [...container.querySelectorAll(".reader-visual-gallery figure")].every(
        (figure) => figure.getAttribute("data-media-surface") === "floating",
      ),
    ).toBe(true);
    expect(container.querySelector(".reader-visual-overlay")).toBe(overlay);
    expect(document.querySelector(".portfolio-visual-stage")).toBeNull();
  });

  it("embeds the working dashboard without an empty planned visual", () => {
    render(<PortfolioReader {...baseProps} selectedId="real-estate" />);

    const link = screen.getByRole("link", { name: "Open full dashboard" });
    expect(link.getAttribute("href")).toBe("/demos/quarterly-dashboard");
    expect(link.closest(".reader-composed-body")).not.toBeNull();
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
    render(
      <PortfolioReader {...baseProps} selectedId="music-practice" />,
    );

    const galleryPurpose = plannedVisualPurpose("music-practice", "gallery");
    expect(screen.getAllByText("Copy in progress")).toHaveLength(1);
    expect(
      screen.getByRole("button", {
        name: `Open gallery visual in reader: ${galleryPurpose}`,
      }),
    ).toBeTruthy();

    for (const label of screen.getAllByText("Copy in progress")) {
      const placeholder = label.closest("aside")!;
      expect(placeholder.classList.contains("reader-text-placeholder")).toBe(true);
      expect(placeholder.classList.contains("reader-draft-placeholder")).toBe(false);
    }

    const visual = screen.getByRole("button", {
      name: `Open gallery visual in reader: ${galleryPurpose}`,
    });
    expect(visual.classList.contains("reader-visual-draft")).toBe(true);
    expect(visual.classList.contains("reader-text-placeholder")).toBe(false);
    expect(visual.querySelector(".reader-visual-placeholder")).toBeTruthy();
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
    expect(screen.getByRole("region", { name: /Visual in reader:/ }).querySelector("img")?.getAttribute("src"))
      .toBe(assets[4].src);
    fireEvent.click(screen.getByRole("button", { name: "Close visual in reader" }));
    fireEvent.click(groups[2]);
    expect(screen.getByRole("region", { name: /Visual in reader:/ }).querySelector("img")?.getAttribute("src"))
      .toBe(assets[7].src);
  });

  it("marks an in-progress summary as placeholder text", () => {
    const id = [...portfolioWorldNodeById.values()].find(
      (node) => node.summaryStatus === "placeholder",
    )!.id;
    render(<PortfolioReader {...baseProps} selectedId={id} />);

    const summary = screen.getByText("[Summary in progress]");
    expect(summary.classList.contains("reader-summary")).toBe(true);
    expect(summary.classList.contains("reader-text-placeholder")).toBe(true);
  });

  it("opens image and gallery blocks through the same reader overlay", () => {
    const cases = [
      { id: "writ", format: "image" },
      { id: "dubs", format: "gallery" },
      { id: "music-practice", format: "gallery" },
    ] as const;

    for (const { id, format } of cases) {
      const { unmount } = render(
        <PortfolioReader {...baseProps} selectedId={id} />,
      );
      const trigger = id === "dubs"
        ? screen.getAllByRole("button", {
            name: /Open gallery visual in reader:/,
          })[0]
        : screen.getByRole("button", {
            name: `Open ${format} visual in reader: ${plannedVisualPurpose(id, format)}`,
          });
      expect(trigger.getAttribute("data-format")).toBe(format);
      fireEvent.click(trigger);
      expect(screen.getByRole("region", { name: /Visual in reader:/ })).toBeTruthy();
      unmount();
    }
  });

  it("supports a clean review mode without maintaining separate content", () => {
    window.history.replaceState({}, "", "/?view=graph&review=clean#music-practice");
    render(
      <PortfolioReader {...baseProps} selectedId="music-practice" />,
    );

    const reader = screen.getByRole("complementary", {
      name: `${portfolioWorldNodeById.get("music-practice")!.label} record`,
    });
    expect(reader.classList.contains("portfolio-reader-clean-review")).toBe(true);
    expect(
      reader.querySelectorAll(
        ".reader-text-placeholder, .reader-visual-draft",
      ),
    ).toHaveLength(countWorkbenchBlocks("music-practice"));
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

    expect(screen.queryByRole("heading", { name: "Threads" })).toBeNull();
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
    render(<PortfolioReader {...baseProps} selectedId="music-practice" />);

    const purpose = plannedVisualPurpose("music-practice", "gallery");
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
