// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedbackNote } from "../worker/portfolio-feedback-store";
import {
  describeElement,
  describeSelection,
  PortfolioFeedback,
  readReviewerCookie,
  type PortfolioFeedbackTransport,
} from "./PortfolioFeedback";

function selectText(element: Element, start: number, end: number) {
  const textNode = element.firstChild!;
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  const live = document.getSelection()!;
  live.removeAllRanges();
  live.addRange(range);
  fireEvent(document, new Event("selectionchange"));
  return range;
}

function transport() {
  let sequence = 0;
  const send = vi.fn(async (draft) => {
    sequence += 1;
    return { ...draft, reviewer: "alice", id: `note-${sequence}`, createdAt: sequence } as FeedbackNote;
  });
  const remove = vi.fn(async () => {});
  return { send, remove } satisfies PortfolioFeedbackTransport;
}

afterEach(() => {
  cleanup();
  document.cookie = "portfolio_reviewer=; Max-Age=0; Path=/";
  document.body.replaceChildren();
});

describe("readReviewerCookie", () => {
  it("reads the code out of the worker's signed cookie", () => {
    expect(readReviewerCookie("other=1; portfolio_reviewer=v1.alice.abc123; x=y")).toBe("alice");
    expect(readReviewerCookie("portfolio_reviewer=v1.Not-Valid.abc")).toBeNull();
    expect(readReviewerCookie("portfolio_reviewer=v2.alice.abc")).toBeNull();
    expect(readReviewerCookie("")).toBeNull();
  });
});

describe("describeElement", () => {
  it("builds a short path of named regions, stopping at an id", () => {
    document.body.innerHTML = `
      <main id="main-content" class="experience portfolio-composition">
        <section class="portfolio-reader">
          <p class="reader-summary">First</p>
          <p class="reader-summary">Make   complexity legible</p>
        </section>
      </main>`;
    const element = document.querySelectorAll(".reader-summary")[1];

    const target = describeElement(element, { x: 0, y: 0 });

    expect(target.selector).toBe(
      "#main-content > section.portfolio-reader > p.reader-summary:nth-of-type(2)",
    );
    expect(target.component).toBe("reader-summary");
    expect(target.text).toBe("Make complexity legible");
    expect(target.rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("keeps world node attributes and skips canvas text", () => {
    document.body.innerHTML = `
      <div class="portfolio-world"><canvas data-world-node="brain-food">ignored</canvas></div>`;
    const target = describeElement(document.querySelector("canvas")!);
    expect(target.selector).toBe('div.portfolio-world > canvas[data-world-node="brain-food"]');
    expect(target.component).toBe("portfolio-world");
    expect(target.text).toBeUndefined();
  });
});

describe("describeSelection", () => {
  it("quotes the selected run with context on each side", () => {
    document.body.innerHTML =
      '<main class="portfolio-composition"><p class="reader-summary">Hey, I run Brain in a Vat Group, which includes a music promotions agency.</p></main>';
    const paragraph = document.querySelector("p")!;
    const range = selectText(paragraph, 10, 32);

    const target = describeSelection(range)!;

    expect(target.quote).toEqual({
      text: "Brain in a Vat Group,",
      prefix: "Hey, I run",
      suffix: "which includes a music promotions agency",
    });
    expect(target.component).toBe("reader-summary");
    expect(target.selector).toMatch(/p\.reader-summary$/u);
  });
});

describe("PortfolioFeedback", () => {
  it("renders nothing without a reviewer cookie", () => {
    const { container } = render(<PortfolioFeedback transport={transport()} />);
    expect(container.innerHTML).toBe("");
  });

  it("mounts only when the signed cookie matches the named reviewer URL", async () => {
    document.cookie = "portfolio_reviewer=v1.alice.signature; Path=/";
    window.history.replaceState(null, "", "/");
    const { rerender } = render(<PortfolioFeedback transport={transport()} />);
    expect(screen.queryByRole("button", { name: "Leave a note" })).toBeNull();

    window.history.replaceState(null, "", "/?reviewer=alice");
    rerender(<PortfolioFeedback transport={transport()} />);
    expect(await screen.findByRole("button", { name: "Leave a note" })).toBeTruthy();
  });

  it("sends a note for the current page and lets the reviewer take it back", async () => {
    const api = transport();
    window.history.replaceState(null, "", "/?view=graph#thread/one");
    document.title = "Bradley Berkman";
    render(<PortfolioFeedback reviewer="alice" transport={api} />);

    fireEvent.click(screen.getByRole("button", { name: "Leave a note" }));
    expect(screen.getByRole("dialog", { name: "Note for Bradley" })).toBeTruthy();
    expect(screen.getByText("Note for Bradley · as alice")).toBeTruthy();

    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Your note"), {
      target: { value: "  The summary wraps oddly.  " },
    });
    expect(send.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(send);
    });

    expect(api.send).toHaveBeenCalledTimes(1);
    expect(api.send.mock.calls[0][0]).toEqual({
      note: "The summary wraps oddly.",
      path: "/?view=graph#thread/one",
      pageTitle: "Bradley Berkman",
      target: undefined,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      userAgent: navigator.userAgent,
    });
    expect(screen.getByText("Sent. Only Bradley sees it.")).toBeTruthy();
    expect((screen.getByLabelText("Your note") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("Sent this visit")).toBeTruthy();
    expect(screen.getByText("The summary wraps oddly.")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take back" }));
    });
    expect(api.remove).toHaveBeenCalledWith("note-1");
    await waitFor(() => expect(screen.queryByText("Sent this visit")).toBeNull());
  });

  it("points at an element on the page and sends its description", async () => {
    const api = transport();
    const summary = document.body.appendChild(document.createElement("p"));
    summary.className = "reader-summary";
    summary.textContent = "Make complexity legible";
    render(<PortfolioFeedback reviewer="alice" transport={api} />);

    fireEvent.click(screen.getByRole("button", { name: "Leave a note" }));
    fireEvent.click(screen.getByRole("button", { name: "Point at something on the page" }));
    expect(screen.getByRole("button", { name: /Click anything on the page/u })).toBeTruthy();

    const onSummaryClick = vi.fn();
    summary.addEventListener("click", onSummaryClick);
    fireEvent.pointerMove(summary);
    fireEvent.click(summary, { clientX: 0, clientY: 0 });
    expect(onSummaryClick).not.toHaveBeenCalled();
    expect(screen.getByText("reader-summary")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toContain("“Make complexity legible”");

    fireEvent.change(screen.getByLabelText("Your note"), { target: { value: "Too wide." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    expect(api.send.mock.calls[0][0].target).toMatchObject({
      selector: "p.reader-summary",
      component: "reader-summary",
      text: "Make complexity legible",
    });
  });

  it("offers to comment on a text selection, quotes it, and can send a suggested edit", async () => {
    const api = transport();
    document.body.innerHTML =
      '<main class="portfolio-composition"><p class="reader-summary">Make complexity legible enough to act on.</p></main>';
    const paragraph = document.querySelector("p")!;
    const { container } = render(<PortfolioFeedback reviewer="alice" transport={api} />, {
      container: document.querySelector("main")!.appendChild(document.createElement("div")),
    });

    selectText(paragraph, 5, 23);
    const control = screen.getByRole("button", { name: "Comment on selection" });
    fireEvent.click(control);

    expect(screen.getByRole("dialog", { name: "Note for Bradley" })).toBeTruthy();
    expect(screen.getByText("“complexity legible”")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Comment", pressed: true })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Suggest an edit" }));
    const replacement = screen.getByLabelText("Suggested replacement") as HTMLTextAreaElement;
    expect(replacement.value).toBe("complexity legible");
    expect((screen.getByRole("button", { name: "Send edit" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(replacement, { target: { value: "complexity readable" } });
    fireEvent.change(screen.getByLabelText("Why, optionally"), { target: { value: "Plainer." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send edit" }));
    });

    expect(api.send.mock.calls[0][0]).toMatchObject({
      note: "Plainer.",
      suggestion: "complexity readable",
      target: {
        component: "reader-summary",
        quote: { text: "complexity legible", prefix: "Make", suffix: "enough to act on." },
      },
    });
    expect(screen.getByText("Edit: complexity readable")).toBeTruthy();
    expect(container.querySelectorAll(".portfolio-feedback-pin")).toHaveLength(0);
  });

  it("pins this visit's notes to their elements and focuses one from its pin", async () => {
    const api = transport();
    const summary = document.body.appendChild(document.createElement("p"));
    summary.className = "reader-summary";
    summary.textContent = "Make complexity legible";
    summary.getBoundingClientRect = () => ({ top: 100, left: 40, right: 240, bottom: 124, width: 200, height: 24, x: 40, y: 100, toJSON: () => ({}) });
    render(<PortfolioFeedback reviewer="alice" transport={api} />);

    fireEvent.click(screen.getByRole("button", { name: "Leave a note" }));
    fireEvent.click(screen.getByRole("button", { name: "Point at something on the page" }));
    fireEvent.click(summary, { clientX: 50, clientY: 110 });
    fireEvent.change(screen.getByLabelText("Your note"), { target: { value: "Too wide." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Close notes" }));

    const pin = await screen.findByRole("button", { name: "Your note 1" });
    expect(pin.style.top).toBe("91px");
    expect(pin.style.left).toBe("231px");
    fireEvent.click(pin);
    expect(screen.getByRole("dialog", { name: "Note for Bradley" })).toBeTruthy();
    expect(screen.getByText("Too wide.").closest("li")!.getAttribute("data-focused")).toBe("true");
  });

  it("asks for a name when the link carried a placeholder code and sends it with each note", async () => {
    const api = transport();
    render(<PortfolioFeedback reviewer="name" transport={api} />);

    fireEvent.click(screen.getByRole("button", { name: "Leave a note" }));
    expect(screen.getByText("Note for Bradley")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your note"), { target: { value: "So proud." } });
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: " Mom " } });
    expect(screen.getByText("Note for Bradley · from Mom")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    expect(api.send.mock.calls[0][0]).toMatchObject({ note: "So proud.", reviewerName: "Mom" });
    expect(screen.queryByLabelText("Your name")).toBeTruthy();
  });

  it("cancels picking with Escape and closes with the control", () => {
    render(<PortfolioFeedback reviewer="alice" transport={transport()} />);
    fireEvent.click(screen.getByRole("button", { name: "Leave a note" }));
    fireEvent.click(screen.getByRole("button", { name: "Point at something on the page" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Point at something on the page" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close notes" }));
    expect(screen.getByRole("button", { name: "Leave a note" })).toBeTruthy();
  });

  it("reports a failed send without losing the draft", async () => {
    const api = transport();
    api.send.mockRejectedValueOnce(new Error("offline"));
    render(<PortfolioFeedback reviewer="alice" transport={api} />);
    fireEvent.click(screen.getByRole("button", { name: "Leave a note" }));
    fireEvent.change(screen.getByLabelText("Your note"), { target: { value: "Keep this." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    expect(screen.getByText("That did not send. Try again.")).toBeTruthy();
    expect((screen.getByLabelText("Your note") as HTMLTextAreaElement).value).toBe("Keep this.");
  });
});
