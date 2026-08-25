// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PortfolioChatClientError,
  type AskPortfolio,
} from "../lib/portfolio-chat-client";
import type { TurnstileRenderer } from "../lib/portfolio-chat-turnstile";
import { PortfolioChat } from "./PortfolioChat";

afterEach(cleanup);

const evidence = {
  id: "project:pitching",
  title: "Pitching system",
  excerpt:
    "Research, curator selection, matching, and outreach arranged around a human approval step.",
  href: "/index/pitching",
  evidenceStatus: "needed" as const,
  projectTitle: "Pitching system",
  stageRole: "instinct" as const,
};

describe("portfolio chat", () => {
  it("holds effects behind the first rendered answer delta", async () => {
    // Catches safe effects running site or avatar work before text becomes the primary response.
    const lifecycle: string[] = [];
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({
        type: "effects",
        effects: {
          siteActions: [{ type: "openProject", target: "project:dubs" }],
          avatarSequence: [{ action: "play", animation: "present" }],
          issues: [],
        },
      });
      lifecycle.push("effects-received");
      expect(lifecycle).toEqual(["turn-start", "effects-received"]);
      onEvent({ type: "answer_delta", delta: "Text leads. [E1]" });
      onEvent({ type: "done" });
    };
    const avatarIntegration = {
      onTurnStart: () => {
        lifecycle.push("turn-start");
      },
      onEvidence: () => {},
      onFirstText: () => {
        lifecycle.push("talking");
      },
      onEffects: () => {
        lifecycle.push(
          screen.queryByText("Text leads. [E1]")
            ? "effects-after-text"
            : "effects-before-text",
        );
      },
      onNotice: () => {},
      onError: () => {},
      onComplete: () => {
        lifecycle.push("done");
      },
    };

    render(
      <PortfolioChat
        avatarIntegration={avatarIntegration}
        onPoseChange={() => {}}
        askPortfolio={askPortfolio}
      />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "Open Dubs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => expect(lifecycle.at(-1)).toBe("done"));
    expect(lifecycle).toEqual([
      "turn-start",
      "effects-received",
      "talking",
      "effects-after-text",
      "done",
    ]);
  });

  it("drops effects when a turn finishes without answer text", async () => {
    // Catches a no-text response executing optional effects without a primary answer.
    const effects: string[] = [];
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({
        type: "effects",
        effects: {
          siteActions: [{ type: "openProject", target: "project:dubs" }],
          avatarSequence: [],
          issues: [],
        },
      });
      onEvent({ type: "done" });
    };

    render(
      <PortfolioChat
        avatarIntegration={{
          onTurnStart: () => {},
          onEvidence: () => {},
          onFirstText: () => {},
          onEffects: () => {
            effects.push("effect");
          },
          onNotice: () => {},
          onError: () => {},
          onComplete: () => {
            effects.push("done");
          },
        }}
        onPoseChange={() => {}}
        askPortfolio={askPortfolio}
      />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "Question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => expect(effects).toContain("done"));
    expect(effects).toEqual(["done"]);
  });

  it.each([
    ["synchronous throw", () => { throw new Error("avatar start failed"); }],
    ["asynchronous rejection", () => Promise.reject(new Error("avatar start failed"))],
  ])("isolates a %s from turn start", async (_label, onTurnStart) => {
    // Catches optional turn-start work preventing transport, state reset, or answer rendering.
    const askPortfolio = vi.fn<AskPortfolio>(async (_question, { onEvent }) => {
      onEvent({ type: "answer_delta", delta: "Chat survives." });
      onEvent({ type: "done" });
    });

    render(
      <PortfolioChat
        avatarIntegration={{
          onTurnStart,
          onEvidence: () => {},
          onFirstText: () => {},
          onEffects: () => {},
          onNotice: () => {},
          onError: () => {},
          onComplete: () => {},
        }}
        onPoseChange={() => {}}
        askPortfolio={askPortfolio}
      />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "Question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText("Chat survives.")).toBeTruthy();
    expect(askPortfolio).toHaveBeenCalledTimes(1);
  });

  it("keeps text first while delivering the avatar lifecycle in event order", async () => {
    // Catches lifecycle work delaying text, replaying the first-delta callback, or reordering effects and failure recovery.
    const lifecycle: string[] = [];
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({ type: "answer_delta", delta: "Safe answer. " });
      onEvent({ type: "answer_delta", delta: "[E1]" });
      onEvent({
        type: "effects",
        effects: { siteActions: [], avatarSequence: [], issues: [] },
      });
      onEvent({
        type: "error",
        code: "provider_unavailable",
        message: "The answer service is temporarily unavailable.",
      });
      onEvent({ type: "done" });
    };
    const avatarIntegration = {
      onTurnStart: () => {
        lifecycle.push("submit");
      },
      onEvidence: () => {
        lifecycle.push("evidence");
      },
      onFirstText: () => {
        lifecycle.push("first-text");
      },
      onEffects: () => {
        lifecycle.push("effects");
      },
      onNotice: () => {
        lifecycle.push("notice");
      },
      onError: () => {
        lifecycle.push("error");
      },
      onComplete: () => {
        lifecycle.push("done");
      },
    };

    render(
      <PortfolioChat
        avatarIntegration={avatarIntegration}
        onPoseChange={() => {}}
        askPortfolio={askPortfolio}
      />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "How does Dubs work?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => expect(lifecycle.at(-1)).toBe("done"));
    expect(lifecycle).toEqual([
      "submit",
      "evidence",
      "first-text",
      "effects",
      "error",
      "done",
    ]);
  });

  it("commits the first answer delta before running avatar work", async () => {
    // Catches avatar scheduling that can get ahead of the primary text response.
    let releaseRequest: (() => void) | undefined;
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "answer_delta", delta: "Text stays primary." });
      await new Promise<void>((resolve) => {
        releaseRequest = resolve;
      });
    };
    const observedText: boolean[] = [];
    const avatarIntegration = {
      onTurnStart: () => {},
      onEvidence: () => {},
      onFirstText: () => {
        observedText.push(Boolean(screen.queryByText("Text stays primary.")));
      },
      onEffects: () => {},
      onNotice: () => {},
      onError: () => {},
      onComplete: () => {},
    };

    render(
      <PortfolioChat
        avatarIntegration={avatarIntegration}
        onPoseChange={() => {}}
        askPortfolio={askPortfolio}
      />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "Question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => expect(observedText).toEqual([true]));
    releaseRequest?.();
  });

  it("aborts the prior turn and ignores its later effects", async () => {
    // Catches a stale stream changing the avatar after a newer question owns the chat.
    const requests: Parameters<AskPortfolio>[1][] = [];
    const askPortfolio: AskPortfolio = async (_question, options) => {
      requests.push(options);
      await new Promise<void>(() => {});
    };
    const effects: string[] = [];
    const starts: string[] = [];
    const avatarIntegration = {
      onTurnStart: () => {
        starts.push("start");
      },
      onEvidence: () => {},
      onFirstText: () => {},
      onEffects: () => {
        effects.push("effect");
      },
      onNotice: () => {},
      onError: () => {},
      onComplete: () => {},
    };

    render(
      <PortfolioChat
        avatarIntegration={avatarIntegration}
        onPoseChange={() => {}}
        askPortfolio={askPortfolio}
      />,
    );
    const input = screen.getByLabelText("Ask a question about the portfolio");
    const form = document.getElementById("portfolio-question-form");
    fireEvent.change(input, { target: { value: "First question" } });
    fireEvent.submit(form!);
    await waitFor(() => expect(requests).toHaveLength(1));
    const firstSignal = requests[0]?.signal;

    fireEvent.change(input, { target: { value: "Second question" } });
    fireEvent.submit(form!);
    await waitFor(() => expect(requests).toHaveLength(2));

    requests[0]?.onEvent({
      type: "effects",
      effects: {
        siteActions: [{ type: "openProject", target: "project:dubs" }],
        avatarSequence: [{ action: "play", animation: "celebrate" }],
        issues: [],
      },
    });
    await Promise.resolve();

    expect(firstSignal?.aborted).toBe(true);
    expect(starts).toEqual(["start", "start"]);
    expect(effects).toEqual([]);
  });

  it("does not submit a question until configured Turnstile verification completes", async () => {
    const askPortfolio = vi.fn<AskPortfolio>(async () => {});
    const renderTurnstile: TurnstileRenderer = vi.fn(async () => ({
      remove: vi.fn(),
      reset: vi.fn(),
    }));

    render(
      <PortfolioChat
        onPoseChange={() => {}}
        askPortfolio={askPortfolio}
        renderTurnstile={renderTurnstile}
        turnstileSiteKey="site-key"
      />,
    );
    const input = screen.getByLabelText("Ask a question about the portfolio");
    fireEvent.change(input, { target: { value: "How does reporting work?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(
      await screen.findByText("Complete verification before asking."),
    ).toBeTruthy();
    expect(askPortfolio).not.toHaveBeenCalled();
  });

  it("forwards a Turnstile token and resets the widget after asking", async () => {
    const askPortfolio = vi.fn<AskPortfolio>(async (_question, options) => {
      expect(options.challengeToken).toBe("challenge-token");
      options.onEvent({ type: "done" });
    });
    const controller = { remove: vi.fn(), reset: vi.fn() };
    const renderTurnstile: TurnstileRenderer = vi.fn(
      async (_container, _siteKey, callbacks) => {
        callbacks.onToken("challenge-token");
        return controller;
      },
    );

    render(
      <PortfolioChat
        onPoseChange={() => {}}
        askPortfolio={askPortfolio}
        renderTurnstile={renderTurnstile}
        turnstileSiteKey="site-key"
      />,
    );
    const input = screen.getByLabelText("Ask a question about the portfolio");
    fireEvent.change(input, { target: { value: "How does reporting work?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => expect(askPortfolio).toHaveBeenCalledTimes(1));
    expect(controller.reset).toHaveBeenCalledTimes(1);
  });

  it("streams a labeled answer separately from its supporting evidence", async () => {
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({ type: "answer_delta", delta: "The approval step " });
      await Promise.resolve();
      onEvent({ type: "answer_delta", delta: "stays human. [E1]" });
      onEvent({ type: "done" });
    };

    render(
      <PortfolioChat onPoseChange={() => {}} askPortfolio={askPortfolio} />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "How does pitching preserve approval?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText("The approval step stays human. [E1]")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Answer" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Supporting portfolio evidence" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "[E1] Pitching system" }).getAttribute("href"),
    ).toBe("/index/pitching");
    expect(screen.getByText("Evidence needed")).toBeTruthy();
    expect(screen.getByText("Instinct")).toBeTruthy();
    expect(screen.getByText(evidence.excerpt)).toBeTruthy();
  });

  // Owner: portfolio chat UI. Retire only if the server sends cited evidence
  // after generation instead of the complete context before generation.
  it("shows only the complete-context sources cited by the answer", async () => {
    const reportingEvidence = {
      ...evidence,
      id: "project:reporting",
      title: "Campaign reporting",
      href: "/index/reporting",
      projectTitle: "Campaign reporting",
    };
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence, reportingEvidence] });
      onEvent({ type: "answer_delta", delta: "Reporting stays reviewable. [E2]" });
      onEvent({ type: "done" });
    };

    render(<PortfolioChat onPoseChange={() => {}} askPortfolio={askPortfolio} />);
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "How does reporting work?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(
      await screen.findByRole("link", { name: "[E2] Campaign reporting" }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "[E1] Pitching system" })).toBeNull();
  });

  it("keeps follow-up context in the current visit without persisting it", async () => {
    const requests: Array<{
      question: string;
      conversation?: readonly { role: "user" | "assistant"; content: string }[];
    }> = [];
    const askPortfolio: AskPortfolio = async (question, options) => {
      requests.push({ question, conversation: options.conversation });
      options.onEvent({ type: "answer_delta", delta: `${question} answer. [E1]` });
      options.onEvent({ type: "done" });
    };

    render(<PortfolioChat onPoseChange={() => {}} askPortfolio={askPortfolio} />);
    const input = screen.getByLabelText("Ask a question about the portfolio");

    fireEvent.change(input, { target: { value: "Tell me about pitching." } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(requests).toHaveLength(1));

    fireEvent.change(input, { target: { value: "What changed?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(requests).toHaveLength(2));

    expect(requests[0]?.conversation).toBeUndefined();
    expect(requests[1]?.conversation).toEqual([
      { role: "user", content: "Tell me about pitching." },
      { role: "assistant", content: "Tell me about pitching. answer. [E1]" },
    ]);
  });

  it("counts only completed general turns and marks the third-turn nudge once", async () => {
    const requests: Array<{
      question: string;
      visitState: { generalTurns: number; portfolioNudgeShown: boolean } | undefined;
    }> = [];
    const askPortfolio: AskPortfolio = async (question, options) => {
      requests.push({ question, visitState: options.visitState });
      const mode = question.startsWith("social") ? "social" : "general";
      options.onEvent({ type: "turn_mode", mode });
      options.onEvent({ type: "answer_delta", delta: `${mode} answer` });
      options.onEvent({ type: "done" });
    };

    render(<PortfolioChat onPoseChange={() => {}} askPortfolio={askPortfolio} />);
    const input = screen.getByLabelText("Ask a question about the portfolio");
    const ask = async (question: string, expectedRequests: number) => {
      fireEvent.change(input, { target: { value: question } });
      fireEvent.click(screen.getByRole("button", { name: "Ask" }));
      await waitFor(() => expect(requests).toHaveLength(expectedRequests));
    };

    await ask("social one", 1);
    await ask("general one", 2);
    await ask("social two", 3);
    await ask("social three", 4);
    await ask("general two", 5);
    await ask("general three", 6);
    await ask("general four", 7);

    expect(requests.map(({ visitState }) => visitState)).toEqual([
      { generalTurns: 0, portfolioNudgeShown: false },
      { generalTurns: 0, portfolioNudgeShown: false },
      { generalTurns: 1, portfolioNudgeShown: false },
      { generalTurns: 1, portfolioNudgeShown: false },
      { generalTurns: 1, portfolioNudgeShown: false },
      { generalTurns: 2, portfolioNudgeShown: false },
      { generalTurns: 2, portfolioNudgeShown: true },
    ]);
  });

  it("keeps the next request disabled until the completed turn is committed", async () => {
    let releaseRequest: (() => void) | undefined;
    const requestFinished = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "turn_mode", mode: "general" });
      onEvent({ type: "answer_delta", delta: "Complete answer" });
      onEvent({ type: "done" });
      await requestFinished;
    };

    render(<PortfolioChat onPoseChange={() => {}} askPortfolio={askPortfolio} />);
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "A general question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Asking…" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true),
    );
    releaseRequest?.();
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Ask" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
  });

  it("reveals preview access after denial and preserves the question after unlock", async () => {
    const askPortfolio = vi.fn<AskPortfolio>(async () => {
      throw new PortfolioChatClientError(
        "preview_required",
        "Preview access is required.",
      );
    });
    const requestPreviewAccess = vi.fn(async () => {});

    render(
      <PortfolioChat
        onPoseChange={() => {}}
        askPortfolio={askPortfolio}
        requestPreviewAccess={requestPreviewAccess}
      />,
    );
    const input = screen.getByLabelText("Ask a question about the portfolio");
    fireEvent.change(input, { target: { value: "How does reporting work?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    const accessInput = await screen.findByLabelText("Preview access code");
    fireEvent.change(accessInput, { target: { value: "invite-code" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock preview" }));

    await waitFor(() =>
      expect(requestPreviewAccess).toHaveBeenCalledWith(
        "invite-code",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(
      await screen.findByText(
        "Preview access ready. Ask again when you're ready.",
      ),
    ).toBeTruthy();
    expect(input).toHaveProperty("value", "How does reporting work?");
    expect(screen.getByRole("button", { name: "Ask" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("shows a redacted preview denial and keeps the unlock form available", async () => {
    const askPortfolio = vi.fn<AskPortfolio>(async () => {
      throw new PortfolioChatClientError(
        "preview_required",
        "Preview access is required.",
      );
    });
    const requestPreviewAccess = vi.fn(async () => {
      throw new PortfolioChatClientError(
        "preview_denied",
        "Preview access was not accepted.",
      );
    });

    render(
      <PortfolioChat
        onPoseChange={() => {}}
        askPortfolio={askPortfolio}
        requestPreviewAccess={requestPreviewAccess}
      />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "Question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const accessInput = await screen.findByLabelText("Preview access code");
    fireEvent.change(accessInput, { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock preview" }));

    expect(
      await screen.findByText("Preview access was not accepted."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Preview access code")).toBeTruthy();
  });

  it("does not expose uncited full context when the provider stream fails", async () => {
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({
        type: "error",
        code: "provider_unavailable",
        message: "The answer service is temporarily unavailable.",
      });
      onEvent({ type: "done" });
    };

    render(
      <PortfolioChat onPoseChange={() => {}} askPortfolio={askPortfolio} />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "How does pitching work?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(
      await screen.findByText("The answer service is temporarily unavailable."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Supporting portfolio evidence" }),
    ).toBeNull();
  });

  it("clears a partial answer when the provider fails mid-stream", async () => {
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({ type: "answer_delta", delta: "Incomplete answer" });
      onEvent({
        type: "error",
        code: "provider_unavailable",
        message: "The answer service is temporarily unavailable.",
      });
      onEvent({ type: "done" });
    };

    render(
      <PortfolioChat onPoseChange={() => {}} askPortfolio={askPortfolio} />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "How does pitching work?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(
      await screen.findByText("The answer service is temporarily unavailable."),
    ).toBeTruthy();
    expect(screen.queryByText("Incomplete answer")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Answer" })).toBeNull();
  });

  it("clears a partial answer when the transport rejects mid-stream", async () => {
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({ type: "answer_delta", delta: "Incomplete transport answer" });
      throw new Error("connection lost");
    };

    render(
      <PortfolioChat onPoseChange={() => {}} askPortfolio={askPortfolio} />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "How does pitching work?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(
      await screen.findByText("The answer service is temporarily unavailable."),
    ).toBeTruthy();
    expect(screen.queryByText("Incomplete transport answer")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Answer" })).toBeNull();
  });

  it("shows the evidence gap instead of inventing an answer", async () => {
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({
        type: "notice",
        code: "insufficient_evidence",
        message:
          "The portfolio does not publish enough evidence to answer that question.",
      });
      onEvent({ type: "done" });
    };

    render(
      <PortfolioChat onPoseChange={() => {}} askPortfolio={askPortfolio} />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about the portfolio"), {
      target: { value: "What patents did Bradley file?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(
      await screen.findByText(
        "The portfolio does not publish enough evidence to answer that question.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Answer" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Supporting portfolio evidence" }),
    ).toBeNull();
  });

  it("stops chat pointer and click events before they reach the landing surface", async () => {
    const onLandingClick = vi.fn();
    const onLandingPointerDown = vi.fn();
    const onPoseChange = vi.fn();
    const landingSurfaceRef = createRef<HTMLDivElement>();
    const askPortfolio: AskPortfolio = async (_question, { onEvent }) => {
      onEvent({ type: "evidence", evidence: [evidence] });
      onEvent({ type: "answer_delta", delta: "Grounded answer. [E1]" });
      onEvent({ type: "done" });
    };

    render(
      <div ref={landingSurfaceRef}>
        <PortfolioChat
          onPoseChange={onPoseChange}
          askPortfolio={askPortfolio}
        />
      </div>,
    );
    landingSurfaceRef.current?.addEventListener("click", onLandingClick);
    landingSurfaceRef.current?.addEventListener(
      "pointerdown",
      onLandingPointerDown,
    );
    const input = screen.getByLabelText("Ask a question about the portfolio");
    fireEvent.pointerDown(input);
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "How does pitching work?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(onPoseChange).toHaveBeenCalledWith("music"));
    const evidenceLink = screen.getByRole("link", { name: "[E1] Pitching system" });
    evidenceLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(evidenceLink);

    expect(onLandingPointerDown).not.toHaveBeenCalled();
    expect(onLandingClick).not.toHaveBeenCalled();
  });

  it("contains preview-control pointer interactions", async () => {
    const onLandingClick = vi.fn();
    const onLandingPointerDown = vi.fn();
    const onLandingPointerUp = vi.fn();
    const landingSurfaceRef = createRef<HTMLDivElement>();
    const askPortfolio = vi.fn<AskPortfolio>(async () => {
      throw new PortfolioChatClientError(
        "preview_required",
        "Preview access is required.",
      );
    });

    render(
      <div ref={landingSurfaceRef}>
        <PortfolioChat onPoseChange={() => {}} askPortfolio={askPortfolio} />
      </div>,
    );
    landingSurfaceRef.current?.addEventListener("click", onLandingClick);
    landingSurfaceRef.current?.addEventListener(
      "pointerdown",
      onLandingPointerDown,
    );
    landingSurfaceRef.current?.addEventListener("pointerup", onLandingPointerUp);

    const input = screen.getByLabelText("Ask a question about the portfolio");
    fireEvent.change(input, { target: { value: "How does pitching work?" } });
    fireEvent.pointerDown(input);
    fireEvent.pointerUp(input);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const accessInput = await screen.findByLabelText("Preview access code");
    fireEvent.pointerDown(accessInput);
    fireEvent.pointerUp(accessInput);
    fireEvent.click(accessInput);
    const unlock = screen.getByRole("button", { name: "Unlock preview" });
    fireEvent.pointerDown(unlock);
    fireEvent.pointerUp(unlock);
    fireEvent.click(unlock);

    expect(onLandingPointerDown).not.toHaveBeenCalled();
    expect(onLandingPointerUp).not.toHaveBeenCalled();
    expect(onLandingClick).not.toHaveBeenCalled();
  });
});
