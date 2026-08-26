"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
import type { PoseState } from "./scene/BodyScene";

const stageRoleLabels = {
  instinct: "Instinct",
  approach: "Approach",
  output: "Output",
} as const;

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
  onPoseChange,
  registerAvatarTarget,
  askPortfolio = streamPortfolioAnswer,
  renderTurnstile: renderTurnstileWidget = renderTurnstile,
  spotlightTarget,
  turnstileSiteKey,
}: {
  avatarIntegration?: PortfolioChatAvatarIntegration;
  onPoseChange: (pose: PoseState) => void;
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
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState<PortfolioGroundingEvidence[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeMessage, setChallengeMessage] = useState("");
  const conversation = useRef<PortfolioChatMessage[]>([]);
  const visitState = useRef<PortfolioChatVisitState>({
    generalTurns: 0,
    portfolioNudgeShown: false,
  });
  const idleTimer = useRef<number | null>(null);
  const inputActivityTimer = useRef<number | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const chatRegion = useRef<HTMLElement | null>(null);
  const turnstileContainer = useRef<HTMLDivElement | null>(null);
  const turnstileController = useRef<TurnstileController | null>(null);
  const setChatRegion = useCallback(
    (element: HTMLElement | null) => {
      chatRegion.current = element;
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
    const region = chatRegion.current;
    const containInteraction = (event: Event) => event.stopPropagation();
    region?.addEventListener("click", containInteraction);
    region?.addEventListener("pointerdown", containInteraction);
    region?.addEventListener("pointerup", containInteraction);

    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      if (inputActivityTimer.current !== null) {
        window.clearTimeout(inputActivityTimer.current);
      }
      requestController.current?.abort();
      region?.removeEventListener("click", containInteraction);
      region?.removeEventListener("pointerdown", containInteraction);
      region?.removeEventListener("pointerup", containInteraction);
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
            if (event.type === "error") setAnswer("");
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
        conversation.current = appendPortfolioChatTurn(
          conversation.current,
          question,
          streamedAnswer,
        );
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
    setPoseForQuestion(question);
    void runQuestion(question);
  }

  const citedEvidence = evidence.flatMap((item, index) => {
    const label = index + 1;
    return answer.includes(`[E${label}]`) ? [{ item, label }] : [];
  });

  return (
    <section
      ref={setChatRegion}
      className={`portfolio-chat${spotlightTarget === "portfolio:chat" ? " avatar-spotlight" : ""}`}
      aria-labelledby="chat-heading"
    >
      <div className="chat-heading-row">
        <div>
          <p className="eyebrow">Ask the portfolio</p>
          <h2 id="chat-heading">Find the work behind the question.</h2>
        </div>
      </div>
      <form id="portfolio-question-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="portfolio-question">
          Ask a question about the portfolio
        </label>
        <input
          id="portfolio-question"
          name="question"
          onBlur={() => {
            if (inputActivityTimer.current !== null) {
              window.clearTimeout(inputActivityTimer.current);
              inputActivityTimer.current = null;
            }
            void avatarIntegration?.onInputBlur?.();
          }}
          onChange={(event) => {
            setInput(event.target.value);
            if (inputActivityTimer.current !== null) return;
            void avatarIntegration?.onInputActivity?.();
            inputActivityTimer.current = window.setTimeout(() => {
              inputActivityTimer.current = null;
            }, 250);
          }}
          onFocus={() => {
            void avatarIntegration?.onInputFocus?.();
          }}
          placeholder="Ask about the work, decisions, or outcomes."
          type="text"
          value={input}
        />
        <button disabled={pending} type="submit">
          {pending ? "Asking…" : "Ask"}
        </button>
      </form>
      {turnstileSiteKey ? (
        <div
          aria-label="Security verification"
          className="chat-turnstile"
          role="group"
        >
          <div ref={turnstileContainer} />
          {challengeMessage ? (
            <p className="chat-note">{challengeMessage}</p>
          ) : null}
        </div>
      ) : null}
      {answer || message || citedEvidence.length > 0 || pending ? (
        <div className="chat-reply" aria-live="polite">
          {answer ? (
            <section aria-labelledby="chat-answer-heading" className="chat-answer">
              <h3 id="chat-answer-heading">Answer</h3>
              <p>{answer}</p>
            </section>
          ) : null}
          {message ? <p className="chat-message">{message}</p> : null}
          {pending && !answer ? <p className="chat-message">Reading the portfolio…</p> : null}
          {citedEvidence.length > 0 ? (
            <section
              aria-labelledby="chat-evidence-heading"
              className="chat-evidence"
            >
              <h3 id="chat-evidence-heading">Supporting portfolio evidence</h3>
              <ol>
                {citedEvidence.map(({ item, label }) => (
                  <li key={item.id}>
                    <div>
                      <a href={item.href}>[E{label}] {item.title}</a>
                      <div className="chat-evidence-labels">
                        {item.stageRole ? (
                          <span>{stageRoleLabels[item.stageRole]}</span>
                        ) : null}
                        <span>Evidence {item.evidenceStatus}</span>
                      </div>
                    </div>
                    <p>{item.excerpt}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
