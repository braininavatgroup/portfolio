// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  PortfolioChatClientError,
  type AskPortfolio,
} from "../lib/portfolio-chat-client";
import { PortfolioChat } from "./PortfolioChat";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

const evidence = {
  id: "node:pitching",
  title: "Music Promo Campaign Pitching",
  excerpt: "A weekly curator workflow.",
  href: "/?view=graph#pitching",
};

function submit(question: string) {
  const input = screen.getByLabelText("Ask a question about the portfolio");
  fireEvent.change(input, { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

describe("docked portfolio Guide", () => {
  it("opens a chat session on mount so the first question is not slower", async () => {
    // The endpoint asks for a session token; establishing it lazily on the
    // first send would make that question pay for a second round trip.
    const openSession = vi.fn(async () => true);
    const askPortfolio = vi.fn<AskPortfolio>(async (_question, options) => {
      options.onEvent({ type: "answer_delta", delta: "A portfolio answer." });
      options.onEvent({ type: "done" });
    });
    render(<PortfolioChat askPortfolio={askPortfolio} openSession={openSession} />);

    await waitFor(() => expect(openSession).toHaveBeenCalledTimes(1));
    const starter = document.querySelector<HTMLButtonElement>(".portfolio-guide-suggestion")!;
    expect(starter.disabled).toBe(false);
    fireEvent.click(starter);
    expect(await screen.findByText("A portfolio answer.")).toBeTruthy();
  });

  it("hydrates online-first connectivity markup before synchronizing the browser state", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);

    const html = renderToString(
      <PortfolioChat askPortfolio={async () => {}} resetSignal={0} />,
    );
    expect(html).toContain('data-offline="false"');
    expect(html).not.toContain("Chat is offline");

    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const hydrationErrors: string[] = [];
    const root = hydrateRoot(
      host,
      <PortfolioChat askPortfolio={async () => {}} resetSignal={0} />,
      { onRecoverableError: (error) => hydrationErrors.push(String(error)) },
    );

    await waitFor(() => {
      expect(host.querySelector(".portfolio-chat")?.getAttribute("data-offline")).toBe("true");
    });
    expect(hydrationErrors.join("\n")).not.toMatch(/hydration|did not match|server rendered/i);
    await act(async () => root.unmount());
    host.remove();
  });

  it("is always mounted through assistant-ui Thread, Message, Suggestion, and Composer primitives", async () => {
    // Catches the old minimized floating dock returning or assistant-ui becoming decorative.
    render(<PortfolioChat askPortfolio={async () => {}} resetSignal={0} />);

    expect(screen.getByRole("region", { name: "Portfolio Guide" }).hidden).toBe(false);
    expect(document.querySelector('[data-guide-primitive="thread"]')).toBeTruthy();
    expect(document.querySelector('[data-guide-primitive="composer"]')).toBeTruthy();
    expect(screen.queryByRole("button", { name: /open portfolio assistant/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /minimize portfolio assistant/i })).toBeNull();

    const starters = await screen.findAllByRole("button", { name: /^(Where|What|Can|Which|How|Go|Wave|Play)/ });
    expect(starters).toHaveLength(3);
    expect(starters.filter((starter) => starter.querySelector(".portfolio-node-mark"))).toHaveLength(3);
    expect(starters.some((starter) => starter.querySelector('[data-control="chevron"]'))).toBe(false);
    fireEvent.click(starters[0]!);
    await waitFor(() => expect(document.querySelector('[data-guide-primitive="message"]')).toBeTruthy());
  });

  it("passes bounded conversation, visit state, and abort signal through AskPortfolio", async () => {
    // Catches the assistant-ui adapter bypassing the protected client options.
    const askPortfolio = vi.fn<AskPortfolio>(async (question, { onEvent }) => {
      onEvent({ type: "turn_mode", mode: "portfolio" });
      onEvent({ type: "answer_delta", delta: `${question} answered.` });
      onEvent({ type: "done" });
    });
    render(<PortfolioChat askPortfolio={askPortfolio} resetSignal={0} />);

    submit("First question");
    await screen.findByText("First question answered.");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Portfolio Guide" }).getAttribute("data-pending")).toBe("false"),
    );
    submit("Second question");
    await screen.findByText("Second question answered.");

    expect(askPortfolio).toHaveBeenNthCalledWith(
      1,
      "First question",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        visitState: { generalTurns: 0, portfolioNudgeShown: false },
      }),
    );
    expect(askPortfolio.mock.calls[0]![1]).not.toHaveProperty("conversation");
    expect(askPortfolio.mock.calls[1]![1].conversation).toEqual([
      { role: "user", content: "First question" },
      { role: "assistant", content: "First question answered." },
    ]);
  });

  it("renders valid citations inline and routes them to Reader and Map navigation", async () => {
    // Catches citations becoming detached evidence pills or ordinary href navigation.
    const onNavigateEvidence = vi.fn();
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({ type: "answer_delta", delta: "The [weekly workflow][E1]. Unknown [E2]." });
      onEvent({ type: "done" });
    };
    render(
      <PortfolioChat
        askPortfolio={askPortfolio}
        onNavigateEvidence={onNavigateEvidence}
        resetSignal={0}
      />,
    );

    submit("Tell me about pitching");
    const citation = await screen.findByRole("link", {
      name: "weekly workflow",
    });
    await screen.findByText((_, element) =>
      Boolean(element?.classList.contains("chat-answer") && element.textContent?.includes("Unknown [E2].")),
    );
    expect(document.querySelector(".chat-evidence-pills")).toBeNull();
    fireEvent.click(citation);

    expect(onNavigateEvidence).toHaveBeenCalledWith(
      { type: "node", id: "pitching" },
      evidence,
    );
  });

  it("keys follow-up prompts to evidence the answer actually cites", async () => {
    // Catches uncited evidence taking precedence over the record discussed in the answer.
    const uncitedEvidence = {
      id: "node:reporting",
      title: "Music Promo Campaign Reporting",
      excerpt: "A reporting workflow.",
      href: "/?view=graph#reporting",
    };
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [uncitedEvidence, evidence] });
      onEvent({ type: "answer_delta", delta: "The [weekly workflow][E2]." });
      onEvent({ type: "done" });
    };
    render(<PortfolioChat askPortfolio={askPortfolio} resetSignal={0} />);

    submit("Tell me about pitching");
    await screen.findByRole("link", {
      name: "weekly workflow",
    });

    const followUp = await screen.findByRole("button", {
        name: "Tell me about Music Promo Campaign Pitching.",
      });
    expect(followUp.querySelector('.portfolio-node-mark[data-family="component"][data-register="bridge"]')).toBeTruthy();
    for (const suggestion of screen.getAllByTestId("guide-suggestion")) {
      expect(suggestion.querySelector(".portfolio-node-mark")).toBeTruthy();
      expect(suggestion.querySelector('[data-control="chevron"]')).toBeNull();
    }
    expect(
      screen.queryByRole("button", { name: "Summarise Music Promo Campaign Reporting" }),
    ).toBeNull();
  });

  it("copies natural link text and removes adjacent evidence markers", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({ type: "answer_delta", delta: "The [weekly workflow][E1] keeps approvals human. [E1][E2]" });
      onEvent({ type: "done" });
    };
    render(<PortfolioChat askPortfolio={askPortfolio} resetSignal={0} />);
    submit("Tell me about pitching");
    fireEvent.click(await screen.findByRole("button", { name: "Copy answer" }));
    expect(writeText).toHaveBeenCalledWith("The weekly workflow keeps approvals human.");
  });

  it("changes the thinking message after four seconds without text", async () => {
    // Catches a premature or stale slow indicator.
    vi.useFakeTimers();
    render(<PortfolioChat askPortfolio={() => new Promise(() => {})} resetSignal={0} />);
    // Flush the run start inside act rather than polling with vi.waitFor:
    // under fake timers, waitFor advances the mocked clock on every poll, so
    // a starved worker could burn the four seconds before the assertions ran.
    await act(async () => {
      submit("A slow question");
      // The runtime starts the run on its next tick; let that tick fire
      // without moving the clock, so the slow timer is armed at t = 0.
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("region", { name: "Portfolio Guide" }).getAttribute("data-pending")).toBe("true");

    // Advance inside act so the state change the timer makes is committed
    // before each assertion reads the DOM.
    await act(() => vi.advanceTimersByTimeAsync(3_999));
    expect(screen.queryByText("Thinking long and hard…")).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByText("Thinking long and hard…")).toBeTruthy();
    expect(document.querySelector(".portfolio-guide-twirl")).toBeTruthy();
  });

  it("removes thinking status as soon as text arrives, even while the stream remains open", async () => {
    vi.useFakeTimers();
    let receive: Parameters<AskPortfolio>[1]["onEvent"] | undefined;
    render(<PortfolioChat askPortfolio={(_question, { onEvent }) => {
      receive = onEvent;
      return new Promise(() => {});
    }} openSession={async () => true} />);
    await act(async () => {
      submit("Start an answer");
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(() => vi.advanceTimersByTimeAsync(4_000));
    expect(screen.getByText("Thinking long and hard…")).toBeTruthy();
    await act(async () => {
      receive?.({ type: "answer_delta", delta: "Here is the beginning." });
    });
    expect(screen.getByText("Here is the beginning.")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(4_000));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offers one retry when a completed stream contains no visible answer", async () => {
    render(<PortfolioChat askPortfolio={async (_question, { onEvent }) => {
      onEvent({ type: "answer_delta", delta: "   " });
      onEvent({ type: "done" });
    }} openSession={async () => true} />);
    submit("Where is the answer?");
    expect(await screen.findByText("Could not finish that reply.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("preserves manual scrollback without adding a jump control", async () => {
    render(<PortfolioChat askPortfolio={async (_question, { onEvent }) => {
      onEvent({ type: "answer_delta", delta: "A sufficiently long answer." });
      onEvent({ type: "done" });
    }} openSession={async () => true} />);
    submit("A question");
    await screen.findByText("A sufficiently long answer.");
    const viewport = document.querySelector<HTMLElement>(".portfolio-chat-viewport")!;
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, value: 1_000 },
      clientHeight: { configurable: true, value: 300 },
    });
    const scrollTo = (top: number) => {
      viewport.scrollTop = top;
      fireEvent.scroll(viewport);
    };
    scrollTo(700);
    scrollTo(680);
    expect(screen.queryByRole("button", { name: "Jump to latest reply" })).toBeNull();
    scrollTo(604);
    expect(screen.queryByRole("button", { name: "Jump to latest reply" })).toBeNull();
    scrollTo(603);
    expect(screen.queryByRole("button", { name: "Jump to latest reply" })).toBeNull();
    expect(viewport.scrollTop).toBe(603);
    scrollTo(640);
    expect(screen.queryByRole("button", { name: "Jump to latest reply" })).toBeNull();
    scrollTo(652);
    expect(screen.queryByRole("button", { name: "Jump to latest reply" })).toBeNull();
  });

  it("keeps the first reply visible after submitting a tall first question", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.matches(".chat-question") ? 480 : 0;
    });
    render(<PortfolioChat askPortfolio={() => new Promise(() => {})} openSession={async () => true} />);
    submit("A very long first question");
    await waitFor(() => expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({ top: 384, behavior: "instant" }));
  });

  it("does not realign a tall opening question after the reader starts scrolling", async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.matches(".chat-question") ? 480 : 0;
    });
    let receive: Parameters<AskPortfolio>[1]["onEvent"] | undefined;
    render(<PortfolioChat askPortfolio={(_question, { onEvent }) => {
      receive = onEvent;
      return new Promise(() => {});
    }} openSession={async () => true} />);
    await act(async () => {
      submit("A long opening question");
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(() => vi.advanceTimersByTimeAsync(100));
    const viewport = document.querySelector<HTMLElement>(".portfolio-chat-viewport")!;
    fireEvent.wheel(viewport, { deltaY: -80 });
    vi.mocked(viewport.scrollTo).mockClear();
    await act(async () => {
      receive?.({ type: "answer_delta", delta: "The reply arrives after scrolling." });
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(viewport.scrollTo).not.toHaveBeenCalled();
  });

  it("releases opening alignment when a new question follows a failed first reply", async () => {
    const observers: { elements: Set<Element> }[] = [];
    vi.stubGlobal("ResizeObserver", class {
      elements = new Set<Element>();
      constructor() { observers.push(this); }
      observe(element: Element) { this.elements.add(element); }
      unobserve(element: Element) { this.elements.delete(element); }
      disconnect() { this.elements.clear(); }
    });
    let turn = 0;
    render(<PortfolioChat askPortfolio={async (_question, { onEvent }) => {
      if (++turn === 1) throw new PortfolioChatClientError("provider_error", "Unavailable");
      onEvent({ type: "answer_delta", delta: "The next question succeeds." });
      onEvent({ type: "done" });
    }} openSession={async () => true} />);
    submit("Opening question");
    await screen.findByRole("button", { name: "Try again" });
    // The retry notice is component state; the runtime mounts its question
    // separately. Wait for its alignment effect before checking cleanup.
    const openingObserver = await waitFor(() => {
      const question = document.querySelector(".chat-question");
      const observer = observers.find(item => question && item.elements.has(question));
      expect(observer).toBeDefined();
      return observer!;
    });
    const firstQuestion = document.querySelector(".chat-question")!;
    submit("A different question after the failure");
    await screen.findByText("The next question succeeds.");
    await waitFor(() => expect(openingObserver.elements.has(firstQuestion)).toBe(false));
  });

  it("opens a follow-up at its beginning and preserves scrollback as that answer grows", async () => {
    vi.useFakeTimers();
    let receive: Parameters<AskPortfolio>[1]["onEvent"] | undefined;
    let turn = 0;
    render(<PortfolioChat askPortfolio={async (_question, { onEvent }) => {
      if (++turn === 1) {
        onEvent({ type: "answer_delta", delta: "First answer." });
        onEvent({ type: "done" });
      } else {
        receive = onEvent;
        onEvent({ type: "answer_delta", delta: "Second answer starts here." });
        await new Promise(() => {});
      }
    }} openSession={async () => true} />);
    await act(async () => {
      submit("First question");
      await vi.advanceTimersByTimeAsync(100);
    });
    const viewport = document.querySelector<HTMLElement>(".portfolio-chat-viewport")!;
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, value: 1_200 },
      clientHeight: { configurable: true, value: 300 },
    });
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
      return this.matches(".chat-question") && this.textContent === "Follow-up question" ? 500 : 0;
    });
    await act(async () => {
      submit("Follow-up question");
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(viewport.scrollTo).toHaveBeenCalledWith({ top: 500, behavior: "smooth" });
    vi.mocked(viewport.scrollTo).mockClear();
    viewport.scrollTop = 450;
    fireEvent.scroll(viewport);
    await act(async () => {
      receive?.({ type: "answer_delta", delta: " More detail that should not move the reader." });
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(viewport.scrollTo).not.toHaveBeenCalled();
    expect(viewport.scrollTop).toBe(450);
  });

  it.each([false, true])("releases a stalled reply, including after partial text: %s", async (partial) => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const askPortfolio: AskPortfolio = (_question, options) => {
      signal = options.signal;
      if (partial) {
        options.onEvent({ type: "turn_mode", mode: "portfolio" });
        options.onEvent({ type: "answer_delta", delta: "Unfinished reply" });
      }
      return new Promise(() => {});
    };
    render(<PortfolioChat askPortfolio={askPortfolio} openSession={async () => true} />);
    await act(async () => {
      submit("A stalled question");
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(signal?.aborted).toBe(true);
    expect(screen.getByText("That reply took too long to arrive.")).toBeTruthy();
    expect(screen.queryByText("Unfinished reply")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Portfolio Guide" }).getAttribute("data-pending")).toBe("false");
  });

  it("shows exact error copy and permits one retry of the failed question", async () => {
    // Catches retries changing the question or creating an unbounded retry loop.
    const askPortfolio = vi.fn<AskPortfolio>(async (_question, { onEvent }) => {
      onEvent({ type: "answer_delta", delta: "partial" });
      throw new PortfolioChatClientError("provider failed", "provider_error");
    });
    render(<PortfolioChat askPortfolio={askPortfolio} resetSignal={0} />);
    submit("Retry this exactly");

    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getByText("Could not finish that reply.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("partial")).toBeNull());
    fireEvent.click(retry);
    await waitFor(() => expect(askPortfolio).toHaveBeenCalledTimes(2));
    expect(askPortfolio.mock.calls.map(([question]) => question)).toEqual([
      "Retry this exactly",
      "Retry this exactly",
    ]);
    expect(screen.getAllByText("Retry this exactly")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("offers HTTPS recovery when an HTTP visit cannot retain the secure session", async () => {
    vi.stubGlobal("location", new URL("http://bradleyberkman.com/?view=graph#pitching"));
    render(<PortfolioChat askPortfolio={async () => {
      throw new PortfolioChatClientError("session_required", "Reload the page to ask again.");
    }} openSession={async () => false} />);
    submit("A question over HTTP");
    const link = await screen.findByRole("link", { name: "Open the secure site" });
    expect(link.getAttribute("href")).toBe("https://bradleyberkman.com/?view=graph#pitching");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("keeps session retry available on HTTPS without suggesting an unnecessary redirect", async () => {
    vi.stubGlobal("location", new URL("https://bradleyberkman.com/"));
    render(<PortfolioChat askPortfolio={async () => {
      throw new PortfolioChatClientError("session_required", "Reload the page to ask again.");
    }} openSession={async () => false} />);
    submit("A question over HTTPS");
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open the secure site" })).toBeNull();
  });

  it("tracks browser offline state and disables the composer with exact placeholder copy", async () => {
    // Catches a browser connectivity change leaving a sendable composer behind.
    let online = false;
    vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online);
    render(<PortfolioChat askPortfolio={async () => {}} resetSignal={0} />);

    const input = screen.getByLabelText("Ask a question about the portfolio");
    expect((input as HTMLTextAreaElement).disabled).toBe(false);
    expect(input.getAttribute("placeholder")).toBe("Chat is offline");

    online = true;
    fireEvent(window, new Event("online"));
    await waitFor(() => expect((input as HTMLTextAreaElement).disabled).toBe(false));
  });

  it("blocks starter prompts while offline", async () => {
      // Catches starter prompts bypassing the same submission gate as the composer.
      let online = false;
      vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online);
      const askPortfolio = vi.fn<AskPortfolio>(async () => {});
      render(
        <PortfolioChat
          askPortfolio={askPortfolio}
          resetSignal={0}
        />,
      );

      const starter = (await screen.findAllByTestId("guide-suggestion"))[0]!;
      expect((starter as HTMLButtonElement).disabled).toBe(true);
      (starter as HTMLButtonElement).disabled = false;
      fireEvent.click(starter);
      await act(async () => {});

      // The adapter is the final backstop even if an assistant-ui control is stale.
      expect(askPortfolio).not.toHaveBeenCalled();
      online = true;
    },
  );

  it("blocks follow-up prompts while offline", async () => {
      // Catches generated follow-ups starting a protected request after eligibility expires.
      let online = true;
      vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online);
      const askPortfolio = vi.fn<AskPortfolio>(async (_question, { onEvent }) => {
        onEvent({ type: "evidence", evidence: [evidence] });
        onEvent({ type: "answer_delta", delta: "A weekly workflow [E1]." });
        onEvent({ type: "done" });
      });
      render(
        <PortfolioChat
          askPortfolio={askPortfolio}
          resetSignal={0}
        />,
      );
      submit("Tell me about pitching");
      const followUp = await screen.findByRole("button", {
        name: "Tell me about Music Promo Campaign Pitching.",
      });

      online = false;
      fireEvent(window, new Event("offline"));
      await waitFor(() => expect((followUp as HTMLButtonElement).disabled).toBe(true));
      fireEvent.click(followUp);
      await act(async () => {});

      expect(askPortfolio).toHaveBeenCalledTimes(1);
    },
  );

  it("blocks retry while offline", async () => {
      // Catches the error recovery path bypassing connectivity eligibility.
      let online = true;
      vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online);
      const askPortfolio = vi.fn<AskPortfolio>(async () => {
        throw new PortfolioChatClientError("provider failed", "provider_error");
      });
      render(
        <PortfolioChat
          askPortfolio={askPortfolio}
          resetSignal={0}
        />,
      );
      submit("Retry this exactly");
      const retry = await screen.findByRole("button", { name: "Try again" });

      online = false;
      fireEvent(window, new Event("offline"));
      await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(true));
      fireEvent.click(retry);
      await act(async () => {});

      expect(askPortfolio).toHaveBeenCalledTimes(1);
    },
  );

  it("marks a question that loses eligibility at send time as failed instead of orphaning it", async () => {
      // Catches the adapter's silent return leaving a user bubble with no answer,
      // no error, and no place in later turns' conversation history.
      let online = true;
      vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online);
      const askPortfolio = vi.fn<AskPortfolio>(async (question, { onEvent }) => {
        onEvent({ type: "answer_delta", delta: `${question} answered.` });
        onEvent({ type: "done" });
      });
      render(
        <PortfolioChat
          askPortfolio={askPortfolio}
          resetSignal={0}
        />,
      );
      const input = screen.getByLabelText("Ask a question about the portfolio");
      fireEvent.change(input, { target: { value: "Was this lost?" } });
      const send = screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement;
      await waitFor(() => expect(send.disabled).toBe(false));

      // Eligibility lapses after the UI check passed: the browser drops
      // offline without firing an event, in the same tick as the click and
      // before React can disable the control.
      act(() => {
        online = false;
        fireEvent.click(send);
      });

      const retry = await screen.findByRole("button", { name: "Try again" });
      expect(askPortfolio).not.toHaveBeenCalled();
      expect(screen.getByText("Could not finish that reply.")).toBeTruthy();
      // The failure notice is component state; the user bubble is the
      // runtime's own subscription and can commit a beat later on a starved
      // worker, so wait for it instead of reading it synchronously.
      expect(await screen.findAllByText("Was this lost?")).toHaveLength(1);
      expect(
        screen.getByRole("region", { name: "Portfolio Guide" }).getAttribute("data-pending"),
      ).toBe("false");

      fireEvent(window, new Event("offline"));
      await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(true));
      expect(input.getAttribute("placeholder")).toBe("Chat is offline");
      online = true;
      fireEvent(window, new Event("online"));
      await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(retry);
      await screen.findByText("Was this lost? answered.");
      await waitFor(() =>
        expect(screen.getByRole("region", { name: "Portfolio Guide" }).getAttribute("data-pending")).toBe("false"),
      );
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      expect(screen.getAllByText("Was this lost?")).toHaveLength(1);

      submit("Next question");
      await screen.findByText("Next question answered.");

      expect(askPortfolio).toHaveBeenCalledTimes(2);
      expect(askPortfolio.mock.calls[0]![0]).toBe("Was this lost?");
      expect(askPortfolio.mock.calls[0]![1]).not.toHaveProperty("conversation");
      expect(askPortfolio.mock.calls[1]![1].conversation).toEqual([
        { role: "user", content: "Was this lost?" },
        { role: "assistant", content: "Was this lost? answered." },
      ]);
    },
  );

  it("sends with Enter, preserves Shift+Enter, and ignores the Enter that commits IME text", async () => {
    // Catches assistant-ui's default Enter handling bypassing the Guide's IME guard.
    const askPortfolio = vi.fn<AskPortfolio>(async (_question, { onEvent }) => {
      onEvent({ type: "answer_delta", delta: "Answer." });
      onEvent({ type: "done" });
    });
    render(<PortfolioChat askPortfolio={askPortfolio} resetSignal={0} />);
    const input = screen.getByLabelText("Ask a question about the portfolio");

    fireEvent.change(input, { target: { value: "First line" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });
    expect(askPortfolio).not.toHaveBeenCalled();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "質問" } });
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(askPortfolio).not.toHaveBeenCalled();

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(askPortfolio).toHaveBeenCalledWith("質問", expect.any(Object)));
  });

  it("resets visible messages, history, visit state, errors, suggestions, and the current request", async () => {
    // Catches resetSignal clearing only the transcript while hidden request state survives.
    let firstOptions: Parameters<AskPortfolio>[1] | undefined;
    const askPortfolio = vi.fn<AskPortfolio>((_question, options) => {
      firstOptions ??= options;
      if (askPortfolio.mock.calls.length === 1) return new Promise(() => {});
      options.onEvent({ type: "answer_delta", delta: "Fresh answer." });
      options.onEvent({ type: "done" });
      return Promise.resolve();
    });
    const onThreadStateChange = vi.fn();
    const { rerender } = render(
      <PortfolioChat
        askPortfolio={askPortfolio}
        onThreadStateChange={onThreadStateChange}
        resetSignal={0}
      />,
    );
    submit("Abandon this");
    await waitFor(() => expect(askPortfolio).toHaveBeenCalledTimes(1));

    rerender(
      <PortfolioChat
        askPortfolio={askPortfolio}
        onThreadStateChange={onThreadStateChange}
        resetSignal={1}
      />,
    );
    expect(firstOptions?.signal?.aborted).toBe(true);
    expect(screen.queryByText("Abandon this")).toBeNull();
    await waitFor(() => expect(onThreadStateChange).toHaveBeenLastCalledWith(false));
    expect(await screen.findAllByTestId("guide-suggestion")).toHaveLength(3);

    submit("Fresh question");
    await screen.findByText("Fresh answer.");
    const freshOptions = askPortfolio.mock.calls[1]![1];
    expect(freshOptions).not.toHaveProperty("conversation");
    expect(freshOptions.visitState).toEqual({ generalTurns: 0, portfolioNudgeShown: false });
  });

  it("lets the assistant-ui runtime abort an active request when Guide unmounts", async () => {
    let signal: AbortSignal | undefined;
    const askPortfolio = vi.fn<AskPortfolio>((_question, options) => {
      signal = options.signal;
      return new Promise(() => {});
    });
    const { unmount } = render(
      <PortfolioChat askPortfolio={askPortfolio} resetSignal={0} />,
    );

    submit("Leave this request running");
    await waitFor(() => expect(signal).toBeDefined());

    expect(() => unmount()).not.toThrow();
    expect(signal?.aborted).toBe(true);
  });

  it("re-establishes a lapsed session and answers the same question", async () => {
    // The endpoint refuses a request whose session has expired. That is the
    // endpoint's business, not the visitor's: recover once and carry on.
    const openSession = vi.fn(async () => true);
    let attempt = 0;
    const askPortfolio = vi.fn<AskPortfolio>(async (question, { onEvent }) => {
      attempt += 1;
      if (attempt === 1) {
        throw new PortfolioChatClientError(
          "session_required",
          "Reload the page to ask again.",
        );
      }
      onEvent({ type: "answer_delta", delta: `${question} answered.` });
      onEvent({ type: "done" });
    });
    render(
      <PortfolioChat
        askPortfolio={askPortfolio}
        openSession={openSession}
        resetSignal={0}
      />,
    );

    submit("Did this survive?");
    const retry = await screen.findByRole("button", { name: "Try again" });
    fireEvent.click(retry);

    await screen.findByText("Did this survive? answered.");
    expect(askPortfolio).toHaveBeenCalledTimes(2);
  });

  it("shows incoming text before the request completes without an artificial reveal delay", async () => {
    let finish!: () => void;
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "answer_delta", delta: "First validated sentence." });
      await new Promise<void>(resolve => { finish = resolve; });
      onEvent({ type: "answer_delta", delta: " Second sentence." });
      onEvent({ type: "done" });
    };
    render(<PortfolioChat askPortfolio={askPortfolio} />);
    submit("Tell me about your work");
    expect(await screen.findByText("First validated sentence.")).toBeTruthy();
    expect(document.querySelector(".portfolio-chat")?.getAttribute("data-pending")).toBe("true");
    await act(async () => finish());
    expect(await screen.findByText("First validated sentence. Second sentence.")).toBeTruthy();
  });

  it.each(["Wave hello", "Can you dance?", "Go for a swim", "Play Brain Food"])(
    "handles %s locally while offline and without a session", async (question) => {
      vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
      const askPortfolio = vi.fn<AskPortfolio>(async () => { throw new Error("No network for play"); });
      const onEffects = vi.fn();
      render(<PortfolioChat askPortfolio={askPortfolio}
        openSession={async () => false}
        avatarIntegration={{ onTurnStart() {}, onFirstText() {}, onEffects }} />);
      const input = screen.getByLabelText("Ask a question about the portfolio");
      fireEvent.change(input, { target: { value: question } });
      const button = screen.getByRole("button", { name: "Ask" });
      expect((button as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(button);
      await waitFor(() => expect(onEffects).toHaveBeenCalledTimes(1));
      expect(askPortfolio).not.toHaveBeenCalled();
    },
  );

  it("hides unavailable action suggestions and explains a typed command", async () => {
    const askPortfolio = vi.fn<AskPortfolio>();
    const onEffects = vi.fn();
    render(<PortfolioChat askPortfolio={askPortfolio}
      actionAvailability={{ status: "unavailable", reducedMotion: false, gameSupported: true }}
      avatarIntegration={{ onTurnStart() {}, onFirstText() {}, onEffects }} />);
    expect(screen.queryByRole("button", { name: "Can you dance?" })).toBeNull();
    submit("Can you dance?");
    expect(await screen.findByText(/avatar couldn't load/i)).toBeTruthy();
    expect(onEffects).not.toHaveBeenCalled();
    expect(askPortfolio).not.toHaveBeenCalled();
  });

  it.each([
    ["budget_exhausted", /daily allowance/i, false],
    ["rate_limited", /wait a minute/i, true],
    ["misconfigured", /temporarily unavailable/i, false],
  ])("explains %s without exposing internal service details", async (code, message, retryable) => {
    render(<PortfolioChat askPortfolio={async () => { throw new PortfolioChatClientError(code, "SECRET INTERNAL DETAILS"); }} />);
    submit("Tell me about Bradley");
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByText("SECRET INTERNAL DETAILS")).toBeNull();
    expect(Boolean(screen.queryByRole("button", { name: "Try again" }))).toBe(retryable);
  });

  it("aborts stale turns and ignores their late events", async () => {
    // Catches an obsolete response replacing a newer answer after reset.
    let releaseFirst: (() => void) | undefined;
    let staleEvent: Parameters<Parameters<AskPortfolio>[1]["onEvent"]>[0] | undefined;
    const askPortfolio = vi.fn<AskPortfolio>((_question, options) => {
      if (askPortfolio.mock.calls.length === 1) {
        return new Promise<void>((resolve) => {
          releaseFirst = resolve;
          staleEvent = { type: "answer_delta", delta: "Stale answer." };
        });
      }
      options.onEvent({ type: "answer_delta", delta: "Current answer." });
      options.onEvent({ type: "done" });
      return Promise.resolve();
    });
    const { rerender } = render(<PortfolioChat askPortfolio={askPortfolio} resetSignal={0} />);
    submit("Old question");
    await waitFor(() => expect(askPortfolio).toHaveBeenCalledTimes(1));
    const oldOptions = askPortfolio.mock.calls[0]![1];

    rerender(<PortfolioChat askPortfolio={askPortfolio} resetSignal={1} />);
    submit("New question");
    await screen.findByText("Current answer.");
    if (staleEvent) oldOptions.onEvent(staleEvent);
    oldOptions.onEvent({ type: "done" });
    releaseFirst?.();
    expect(oldOptions.signal?.aborted).toBe(true);
    expect(screen.queryByText("Stale answer.")).toBeNull();
  });

  it("keeps the narrow avatar callbacks ordered behind rendered text", async () => {
    // Catches the Guide restoring deleted director callbacks or running the
    // closed swim action before the primary answer appears.
    const calls: string[] = [];
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({
        type: "effects",
        effects: { avatarAction: "swim_lap", issues: [] },
      });
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({ type: "answer_delta", delta: "Text first. [E1]" });
      onEvent({ type: "done" });
    };
    render(
      <PortfolioChat
        askPortfolio={askPortfolio}
        avatarIntegration={{
          onTurnStart: () => { calls.push("start"); },
          onFirstText: () => {
            calls.push(
              document.querySelector(".chat-answer")?.textContent
                ? "first-after-text"
                : "first-before-text",
            );
          },
          onEffects: (effects) => {
            calls.push(effects.avatarAction ?? "no-action");
          },
        }}
        resetSignal={0}
      />,
    );

    submit("Show pitching");

    await waitFor(() => expect(calls).toContain("swim_lap"));
    expect(calls).toEqual(["start", "first-after-text", "swim_lap"]);
  });

  it.each([
    ["synchronous throw", () => { throw new Error("avatar start failed"); }],
    ["asynchronous rejection", () => Promise.reject(new Error("avatar start failed"))],
  ])("isolates a %s from avatar turn start", async (_label, onTurnStart) => {
    const askPortfolio = vi.fn<AskPortfolio>(async (_question, { onEvent }) => {
      onEvent({ type: "answer_delta", delta: "Guide survives." });
      onEvent({ type: "done" });
    });
    render(
      <PortfolioChat
        askPortfolio={askPortfolio}
        avatarIntegration={{
          onTurnStart,
          onFirstText: () => {},
          onEffects: () => {},
        }}
        resetSignal={0}
      />,
    );

    submit("Question");

    expect(await screen.findByText("Guide survives.")).toBeTruthy();
    expect(askPortfolio).toHaveBeenCalledTimes(1);
  });

  it("drops an avatar effect when a turn completes without answer text", async () => {
    const onEffects = vi.fn();
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({
        type: "effects",
        effects: { avatarAction: "swim_lap", issues: [] },
      });
      onEvent({ type: "done" });
    };
    render(
      <PortfolioChat
        askPortfolio={askPortfolio}
        avatarIntegration={{
          onTurnStart: () => {},
          onFirstText: () => {},
          onEffects,
        }}
        resetSignal={0}
      />,
    );

    submit("No answer");

    await waitFor(() =>
      expect(
        screen
          .getByRole("region", { name: "Portfolio Guide" })
          .getAttribute("data-pending"),
      ).toBe("false"),
    );
    expect(onEffects).not.toHaveBeenCalled();
  });


  it("registers its docked avatar area, reports layout changes, and copies clean answer text", async () => {
    // Catches removing protected layout/avatar wiring while replacing the panel.
    let reportResize: (() => void) | undefined;
    const observe = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          this.report = () => callback([], this as unknown as ResizeObserver);
        }
        report: () => void;
        observe = (element: Element) => {
          observe(element);
          if (element.classList.contains("portfolio-guide-avatar")) reportResize = this.report;
        };
        unobserve() {}
        disconnect() {}
      },
    );
    const registerAvatarDock = vi.fn();
    const onLayoutChange = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...window.navigator, onLine: true, clipboard: { writeText } });
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({ type: "answer_delta", delta: "Copy [this][E1]." });
      onEvent({ type: "done" });
    };
    const { unmount } = render(
      <PortfolioChat
        askPortfolio={askPortfolio}
        onLayoutChange={onLayoutChange}
        registerAvatarDock={registerAvatarDock}
        resetSignal={0}
      />,
    );
    expect(registerAvatarDock).toHaveBeenCalledWith(
      expect.objectContaining({ className: "portfolio-guide-avatar" }),
    );
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({ className: "portfolio-guide-avatar" }),
    );
    onLayoutChange.mockClear();
    reportResize?.();
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    const input = screen.getByLabelText("Ask a question about the portfolio");
    fireEvent.change(input, { target: { value: "Copy" } });
    expect(onLayoutChange).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByText((_, element) =>
      Boolean(element?.classList.contains("chat-answer") && element.textContent === "Copy this."),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy answer" }));
    expect(writeText).toHaveBeenCalledWith("Copy this.");
    unmount();
    expect(registerAvatarDock).toHaveBeenLastCalledWith(null);
  });
});
