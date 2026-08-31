"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  PortfolioChatClientError,
  streamPortfolioAnswer,
  type AskPortfolio,
} from "../lib/portfolio-chat-client";
import {
  renderTurnstile,
  type TurnstileController,
  type TurnstileRenderer,
} from "../lib/portfolio-chat-turnstile";
import {
  appendPortfolioChatTurn,
  type PortfolioChatMessage,
} from "../lib/portfolio-chat-conversation";
import type { PortfolioGroundingEvidence } from "../lib/portfolio-grounding";
import type {
  AvatarTargetId,
  PortfolioResponseEffects,
} from "../lib/avatar/contracts";
import type {
  PortfolioChatTurnMode,
  PortfolioChatVisitState,
} from "../lib/portfolio-chat-protocol";
import { classifyPose } from "../lib/pose";
import type { PoseState } from "../lib/pose";

type AvatarLifecycleCallback<Arguments extends unknown[] = []> = (
  ...arguments_: Arguments
) => void | Promise<void>;

export type PortfolioChatAvatarIntegration = {
  onInputFocus?: AvatarLifecycleCallback;
  onInputActivity?: AvatarLifecycleCallback;
  onInputBlur?: AvatarLifecycleCallback;
  onTurnStart: AvatarLifecycleCallback;
  onEvidence: AvatarLifecycleCallback<[PortfolioGroundingEvidence[]]>;
  onFirstText: AvatarLifecycleCallback;
  onEffects: AvatarLifecycleCallback<[PortfolioResponseEffects]>;
  onNotice: AvatarLifecycleCallback;
  onError: AvatarLifecycleCallback;
  onComplete: AvatarLifecycleCallback;
};

export function PortfolioChat({
  avatarIntegration,
  initiallyOpen = false,
  onLayoutChange,
  onOpenChange,
  onPoseChange,
  open: controlledOpen,
  registerAvatarTarget,
  askPortfolio = streamPortfolioAnswer,
  renderTurnstile: renderTurnstileWidget = renderTurnstile,
  spotlightTarget,
  turnstileSiteKey,
}: {
  avatarIntegration?: PortfolioChatAvatarIntegration;
  initiallyOpen?: boolean;
  onLayoutChange?: () => void;
  onOpenChange?: (open: boolean) => void;
  onPoseChange: (pose: PoseState) => void;
  open?: boolean;
  registerAvatarTarget?: (
    target: AvatarTargetId,
    element: HTMLElement | null,
  ) => void;
  askPortfolio?: AskPortfolio;
  renderTurnstile?: TurnstileRenderer;
  spotlightTarget?: AvatarTargetId | null;
  turnstileSiteKey?: string;
}) {
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState<PortfolioGroundingEvidence[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeMessage, setChallengeMessage] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(initiallyOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );
  const [transcript, setTranscript] = useState<PortfolioChatMessage[]>([]);
  const [panelPosition, setPanelPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const conversation = useRef<PortfolioChatMessage[]>([]);
  const visitState = useRef<PortfolioChatVisitState>({
    generalTurns: 0,
    portfolioNudgeShown: false,
  });
  const idleTimer = useRef<number | null>(null);
  const inputActivityTimer = useRef<number | null>(null);
  const compositionEndTimer = useRef<number | null>(null);
  const composing = useRef(false);
  const compositionJustEnded = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputHeight = useRef(-1);
  const mobileBackRef = useRef<HTMLButtonElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const panelDrag = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const turnstileContainer = useRef<HTMLDivElement | null>(null);
  const turnstileController = useRef<TurnstileController | null>(null);
  const setChatPanel = useCallback(
    (element: HTMLElement | null) => {
      panelRef.current = element;
      registerAvatarTarget?.("portfolio:chat", element);
    },
    [registerAvatarTarget],
  );

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileContainer.current) return;
    let active = true;
    setChallengeMessage("Preparing verification…");
    void renderTurnstileWidget(turnstileContainer.current, turnstileSiteKey, {
      onToken: (token) => {
        if (!active) return;
        setChallengeToken(token);
        setChallengeMessage("");
      },
      onError: () => {
        if (!active) return;
        setChallengeToken(null);
        setChallengeMessage("Verification is unavailable. Try again.");
      },
      onExpired: () => {
        if (!active) return;
        setChallengeToken(null);
        setChallengeMessage("Complete verification before asking.");
      },
    })
      .then((controller) => {
        if (!active) {
          controller.remove();
          return;
        }
        turnstileController.current = controller;
        setChallengeMessage("");
      })
      .catch(() => {
        if (active) setChallengeMessage("Verification is unavailable. Try again.");
      });

    return () => {
      active = false;
      turnstileController.current?.remove();
      turnstileController.current = null;
    };
  }, [renderTurnstileWidget, turnstileSiteKey]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      if (inputActivityTimer.current !== null) {
        window.clearTimeout(inputActivityTimer.current);
      }
      if (compositionEndTimer.current !== null) {
        window.clearTimeout(compositionEndTimer.current);
      }
      requestController.current?.abort();
    };
  }, []);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [answer, lastQuestion, message, pending, transcript]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!onLayoutChange || !panel || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(onLayoutChange);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [onLayoutChange, open]);

  useEffect(() => {
    if (!open || typeof window === "undefined" || window.innerWidth > 600) return;
    const timer = window.setTimeout(() => mobileBackRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const clampPanel = (x: number, y: number, width: number, height: number) => {
      const reader = document.querySelector<HTMLElement>(".portfolio-reader");
      const readerLeft = reader?.getBoundingClientRect().left ?? window.innerWidth;
      return {
        x: Math.min(Math.max(x, 82), Math.max(82, readerLeft - width - 12)),
        y: Math.min(Math.max(y, 12), Math.max(12, window.innerHeight - height - 12)),
        width,
        height,
      };
    };
    const move = (event: PointerEvent) => {
      const active = panelDrag.current;
      const panel = panelRef.current;
      if (!active || !panel || event.pointerId !== active.pointerId) return;
      const bounds = panel.getBoundingClientRect();
      setPanelPosition(
        clampPanel(
          event.clientX - active.offsetX,
          event.clientY - active.offsetY,
          bounds.width,
          bounds.height,
        ),
      );
    };
    const stop = (event: PointerEvent) => {
      if (panelDrag.current?.pointerId !== event.pointerId) return;
      panelDrag.current = null;
    };
    const resize = () => {
      setPanelPosition((current) =>
        current
          ? clampPanel(current.x, current.y, current.width, current.height)
          : current,
      );
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("resize", resize);
    };
  }, []);

  function setPoseForQuestion(question: string) {
    const pose = classifyPose(question);
    if (pose === "idle") return;
    onPoseChange(pose);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => onPoseChange("idle"), 4800);
  }

  async function runQuestion(question: string) {
    if (turnstileSiteKey && !challengeToken) {
      setChallengeMessage("Complete verification before asking.");
      return;
    }
    const questionChallengeToken = challengeToken ?? undefined;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const conversationAtStart = conversation.current;
    const visitStateAtStart = { ...visitState.current };
    let streamedAnswer = "";
    let streamFailed = false;
    let streamCompleted = false;
    let turnMode: PortfolioChatTurnMode | undefined;
    let receivedText = false;
    let avatarWork = Promise.resolve();
    const pendingEffects: PortfolioResponseEffects[] = [];
    const isCurrentTurn = () =>
      !controller.signal.aborted && requestController.current === controller;
    const runAvatarWorkSafely = (work: () => void | Promise<void>) => {
      try {
        return Promise.resolve(work()).catch(() => {});
      } catch {
        return Promise.resolve();
      }
    };
    const scheduleAvatarWork = (work: () => void | Promise<void>) => {
      avatarWork = avatarWork.then(async () => {
        if (!isCurrentTurn()) return;
        await runAvatarWorkSafely(work);
      });
    };
    const scheduleAvatarWorkAfterRender = (
      work: () => void | Promise<void>,
    ) => {
      scheduleAvatarWork(
        () =>
          new Promise<void>((resolve) => {
            window.setTimeout(async () => {
              if (isCurrentTurn()) {
                try {
                  await work();
                } catch {
                  // Avatar work is optional and must never interrupt text.
                }
              }
              resolve();
            }, 0);
          }),
      );
    };
    const scheduleEffects = (effects: PortfolioResponseEffects) => {
      scheduleAvatarWork(() => avatarIntegration?.onEffects(effects));
    };

    avatarWork = runAvatarWorkSafely(
      () => avatarIntegration?.onTurnStart(),
    );
    setAnswer("");
    setEvidence([]);
    setMessage("");
    setPending(true);

    try {
      await askPortfolio(question, {
        signal: controller.signal,
        ...(conversationAtStart.length
          ? { conversation: conversationAtStart }
          : {}),
        visitState: visitStateAtStart,
        ...(questionChallengeToken
          ? { challengeToken: questionChallengeToken }
          : {}),
        onEvent: (event) => {
          if (!isCurrentTurn()) return;
          if (event.type === "evidence") {
            setEvidence(event.evidence);
            scheduleAvatarWork(() => avatarIntegration?.onEvidence(event.evidence));
          }
          if (event.type === "turn_mode") turnMode = event.mode;
          if (event.type === "answer_delta") {
            streamedAnswer += event.delta;
            setAnswer((current) => current + event.delta);
            if (!receivedText) {
              receivedText = true;
              if (avatarIntegration) {
                scheduleAvatarWorkAfterRender(() =>
                  avatarIntegration.onFirstText(),
                );
              }
              for (const effects of pendingEffects.splice(0)) {
                scheduleEffects(effects);
              }
            }
          }
          if (event.type === "effects") {
            if (receivedText) {
              scheduleEffects(event.effects);
            } else {
              pendingEffects.push(event.effects);
            }
          }
          if (event.type === "notice" || event.type === "error") {
            if (event.type === "error") streamFailed = true;
            if (event.type === "error") {
              setAnswer("");
              setInput((current) => current || question);
            }
            setMessage(event.message);
            scheduleAvatarWork(() =>
              event.type === "notice"
                ? avatarIntegration?.onNotice()
                : avatarIntegration?.onError(),
            );
          }
          if (event.type === "done") streamCompleted = true;
        },
      });
      if (
        !controller.signal.aborted &&
        !streamFailed &&
        streamCompleted &&
        streamedAnswer.trim() &&
        requestController.current === controller
      ) {
        const nextConversation = appendPortfolioChatTurn(
          conversation.current,
          question,
          streamedAnswer,
        );
        conversation.current = nextConversation;
        setTranscript(nextConversation);
        if (turnMode === "general") {
          const isThirdGeneralTurn =
            visitStateAtStart.generalTurns >= 2 &&
            !visitStateAtStart.portfolioNudgeShown;
          visitState.current = {
            generalTurns: Math.min(2, visitStateAtStart.generalTurns + 1),
            portfolioNudgeShown:
              visitStateAtStart.portfolioNudgeShown || isThirdGeneralTurn,
          };
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setAnswer("");
      setInput((current) => current || question);
      scheduleAvatarWork(() => avatarIntegration?.onError());
      setMessage(
        error instanceof PortfolioChatClientError
          ? error.message
          : "The answer service is temporarily unavailable.",
      );
    } finally {
      if (turnstileSiteKey) {
        setChallengeToken(null);
        turnstileController.current?.reset();
      }
      await avatarWork;
      if (isCurrentTurn()) {
        try {
          await avatarIntegration?.onComplete();
        } catch {
          // Avatar work is optional and must never interrupt chat cleanup.
        }
      }
      if (requestController.current === controller) {
        requestController.current = null;
        setPending(false);
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;
    setLastQuestion(question);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    inputHeight.current = -1;
    inputRef.current?.blur();
    setPoseForQuestion(question);
    void runQuestion(question);
  }

  function submitOnEnter(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      composing.current ||
      compositionJustEnded.current ||
      pending ||
      event.keyCode === 229
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  const citedEvidence = evidence.flatMap((item, index) => {
    const label = index + 1;
    return answer.includes(`[E${label}]`) ? [{ item, label }] : [];
  });
  const history =
    lastQuestion &&
    answer &&
    transcript.at(-2)?.role === "user" &&
    transcript.at(-2)?.content === lastQuestion &&
    transcript.at(-1)?.role === "assistant" &&
    transcript.at(-1)?.content === answer
      ? transcript.slice(0, -2)
      : transcript;
  const hasThreadContent = Boolean(
    history.length || lastQuestion || answer || message || pending || citedEvidence.length,
  );

  function beginPanelDrag(event: ReactPointerEvent<HTMLElement>) {
    if (
      event.button !== 0 ||
      window.matchMedia("(max-width: 900px)").matches ||
      (event.target instanceof Element && event.target.closest("button"))
    ) {
      return;
    }
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    panelDrag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
    };
  }

  function minimize() {
    setPanelPosition(null);
    setOpen(false);
  }

  const dockStyle = panelPosition
    ? ({
        left: `${
          open
            ? panelPosition.x - 63
            : panelPosition.x + panelPosition.width - 103
        }px`,
        top: `${
          open
            ? panelPosition.y
            : panelPosition.y + panelPosition.height - 40
        }px`,
        right: "auto",
        bottom: "auto",
      } satisfies CSSProperties)
    : undefined;

  return (
    <section
      className={`portfolio-chat${spotlightTarget === "portfolio:chat" ? " avatar-spotlight" : ""}`}
      aria-label="Portfolio assistant dock"
      data-clarity-mask="true"
      data-has-thread={hasThreadContent ? "true" : "false"}
      data-input-focused={inputFocused ? "true" : "false"}
      data-open={open ? "true" : "false"}
      style={dockStyle}
    >
      <nav
        aria-label="Portfolio assistant navigation"
        className="portfolio-chat-mobile-nav"
        hidden={!open}
      >
        <button
          aria-label="Back to portfolio index"
          onClick={minimize}
          ref={mobileBackRef}
          type="button"
        >
          Index
        </button>
        <b>Chat about the portfolio</b>
        <span aria-hidden="true" />
      </nav>
      <div className="portfolio-chat-anchor">
        <section
          aria-label="Portfolio assistant"
          className="portfolio-chat-panel"
          hidden={!open}
          ref={setChatPanel}
        >
          <header className="portfolio-chat-head" onPointerDown={beginPanelDrag}>
            <b>Chat about the portfolio</b>
            <button
              aria-label="Minimize portfolio assistant"
              onClick={minimize}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              ×
            </button>
          </header>
          <div
            aria-live="polite"
            className="portfolio-chat-thread"
            hidden={!hasThreadContent}
            ref={threadRef}
          >
            {history.map((item, index) =>
              item.role === "user" ? (
                <div className="chat-question" key={`history-${index}`}><p>{item.content}</p></div>
              ) : (
                <p className="chat-answer" key={`history-${index}`}>{item.content}</p>
              ),
            )}
            {lastQuestion ? <div className="chat-question"><p>{lastQuestion}</p></div> : null}
            {answer ? (
              <section aria-labelledby="chat-answer-heading">
                <h3 className="sr-only" id="chat-answer-heading">Answer</h3>
                <p className="chat-answer">{answer}</p>
              </section>
            ) : null}
            {message ? <p className="chat-message">{message}</p> : null}
            {pending && !answer ? <p className="chat-message">Reading the portfolio…</p> : null}
            {citedEvidence.length > 0 ? (
              <section aria-labelledby="chat-evidence-heading" className="chat-evidence-pills">
                <h3 className="sr-only" id="chat-evidence-heading">Supporting portfolio evidence</h3>
                {citedEvidence.map(({ item, label }) => (
                  <a aria-label={`[E${label}] ${item.title}`} href={item.href} key={item.id}>
                    E{label} · {item.title}
                    <span className="sr-only">{item.excerpt}</span>
                  </a>
                ))}
              </section>
            ) : null}
          </div>
          {turnstileSiteKey ? (
            <div aria-label="Security verification" className="chat-turnstile" role="group">
              <div ref={turnstileContainer} />
              {challengeMessage ? <p className="chat-note">{challengeMessage}</p> : null}
            </div>
          ) : null}
          <form className="portfolio-chat-composer" id="portfolio-question-form" onSubmit={submit}>
            <label className="sr-only" htmlFor="portfolio-question">Ask a question about the portfolio</label>
            <textarea
              id="portfolio-question"
              name="question"
              onBlur={() => {
                setInputFocused(false);
                if (inputActivityTimer.current !== null) {
                  window.clearTimeout(inputActivityTimer.current);
                  inputActivityTimer.current = null;
                }
                void avatarIntegration?.onInputBlur?.();
              }}
              onChange={(event) => {
                setInput(event.target.value);
                event.target.style.height = "auto";
                const maximumHeight = 65;
                const nextHeight = Math.min(event.target.scrollHeight, maximumHeight);
                if (nextHeight > 0) {
                  event.target.style.height = `${nextHeight}px`;
                  event.target.style.overflowY =
                    event.target.scrollHeight > maximumHeight ? "auto" : "hidden";
                }
                if (nextHeight !== inputHeight.current) {
                  inputHeight.current = nextHeight;
                  onLayoutChange?.();
                }
                if (inputActivityTimer.current !== null) return;
                void avatarIntegration?.onInputActivity?.();
                inputActivityTimer.current = window.setTimeout(() => {
                  inputActivityTimer.current = null;
                }, 250);
              }}
              onCompositionEnd={() => {
                composing.current = false;
                compositionJustEnded.current = true;
                compositionEndTimer.current = window.setTimeout(() => {
                  compositionJustEnded.current = false;
                  compositionEndTimer.current = null;
                }, 0);
              }}
              onCompositionStart={() => {
                composing.current = true;
                compositionJustEnded.current = false;
                if (compositionEndTimer.current !== null) {
                  window.clearTimeout(compositionEndTimer.current);
                  compositionEndTimer.current = null;
                }
              }}
              onFocus={() => {
                setInputFocused(true);
                void avatarIntegration?.onInputFocus?.();
              }}
              onKeyDown={submitOnEnter}
              placeholder="Ask a follow-up"
              ref={inputRef}
              rows={1}
              value={input}
            />
            <button aria-label={pending ? "Asking…" : "Ask"} disabled={pending} type="submit">↑</button>
          </form>
        </section>
        <button
          aria-expanded={open}
          aria-label="Open portfolio assistant"
          className="portfolio-chat-trigger"
          hidden={open}
          onClick={() => setOpen(true)}
          type="button"
        >
          <span aria-hidden="true" className="portfolio-chat-glyph" />
        </button>
      </div>
    </section>
  );
}
