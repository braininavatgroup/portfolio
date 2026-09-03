"use client";

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  type ChatModelAdapter,
  type TextMessagePartProps,
} from "@assistant-ui/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  streamPortfolioAnswer,
  type AskPortfolio,
} from "../lib/portfolio-chat-client";
import {
  appendPortfolioChatTurn,
  type PortfolioChatMessage,
} from "../lib/portfolio-chat-conversation";
import type { PortfolioGroundingEvidence } from "../lib/portfolio-grounding";
import {
  portfolioControlMarkPrimitives,
  type PortfolioControlMarkKind,
} from "../lib/portfolio-control-mark";
import {
  parseGuideAnswerSegments,
  type GuideEvidenceTarget,
} from "../lib/portfolio-guide-citations";
import {
  getGuideFollowUpPrompts,
  getGuideInitialPrompts,
  type GuidePrompt,
} from "../lib/portfolio-guide-prompts";
import {
  renderTurnstile,
  type TurnstileController,
  type TurnstileRenderer,
} from "../lib/portfolio-chat-turnstile";
import type { PortfolioResponseEffects } from "../lib/avatar/contracts";
import type {
  PortfolioChatTurnMode,
  PortfolioChatVisitState,
} from "../lib/portfolio-chat-protocol";
import {
  portfolioThreadById,
  portfolioWorldNodeById,
  type PortfolioWorldRegister,
} from "../lib/portfolio-world";
import { portfolioInterfaceText } from "../lib/portfolio-world";
import { PortfolioNodeMark } from "./PortfolioNodeMark";
import { useEditableContent } from "./editor/EditableText";

type AvatarLifecycleCallback<Arguments extends unknown[] = []> = (
  ...arguments_: Arguments
) => void | Promise<void>;

export type PortfolioChatAvatarIntegration = {
  onTurnStart: AvatarLifecycleCallback;
  onFirstText: AvatarLifecycleCallback;
  onEffects: AvatarLifecycleCallback<[PortfolioResponseEffects]>;
};

export type PortfolioChatProps = {
  avatarIntegration?: PortfolioChatAvatarIntegration;
  onLayoutChange?: () => void;
  onNavigateEvidence?: (
    target: GuideEvidenceTarget,
    evidence: PortfolioGroundingEvidence,
  ) => void;
  onThreadStateChange?: (hasThread: boolean) => void;
  registerAvatarDock?: (element: HTMLElement | null) => void;
  resetSignal?: number;
  askPortfolio?: AskPortfolio;
  renderTurnstile?: TurnstileRenderer;
  turnstileSiteKey?: string;
  /** Accepted until PortfolioExperience moves to the Reading Room shell. */
  initiallyOpen?: boolean;
  /** Accepted until PortfolioExperience moves to the Reading Room shell. */
  onOpenChange?: (open: boolean) => void;
  /** The docked Guide is mounted regardless of this transitional value. */
  open?: boolean;
};

type GuideMessageMetadata = {
  citedEvidence: PortfolioGroundingEvidence[];
  evidence: PortfolioGroundingEvidence[];
};

type GuideNavigationContextValue = PortfolioChatProps["onNavigateEvidence"];

const GuideNavigationContext = createContext<GuideNavigationContextValue>(undefined);
const GuideFirstTextContext = createContext<() => void>(() => {});
const browserGuideVisitSeed = typeof window === "undefined" ? 0 : Date.now();
const getBrowserGuideVisitSeed = () => browserGuideVisitSeed;
const getServerGuideVisitSeed = () => 0;
const subscribeGuideVisitSeed = () => () => {};

function GuideControlGlyph({ kind }: { kind: PortfolioControlMarkKind }) {
  return (
    <span aria-hidden="true" className="portfolio-control-glyph" data-control={kind}>
      <svg focusable="false" viewBox="-9 -9 18 18">
        {portfolioControlMarkPrimitives(kind).map((primitive, index) => {
          if (primitive.kind !== "path") return null;
          return (
            <path
              d={primitive.d}
              fill={primitive.fill ? "currentColor" : "none"}
              key={index}
              stroke={primitive.fill ? "none" : undefined}
            />
          );
        })}
      </svg>
    </span>
  );
}

function messageText(message: {
  content: readonly { type: string; text?: string }[];
}) {
  return message.content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function guideEvidenceFromMetadata(
  value: unknown,
  key: keyof GuideMessageMetadata = "evidence",
) {
  if (!value || typeof value !== "object" || !(key in value)) return [];
  const evidence = Reflect.get(value, key);
  return Array.isArray(evidence)
    ? (evidence as PortfolioGroundingEvidence[])
    : [];
}

function evidenceRegister(
  target: GuideEvidenceTarget,
): PortfolioWorldRegister {
  if (target.type === "home") return "identity";
  const node = target.type === "node"
    ? portfolioWorldNodeById.get(target.id)
    : portfolioWorldNodeById.get(portfolioThreadById.get(target.id)?.nodeId ?? "");
  return node?.register ?? "identity";
}

function GuideAssistantText({ text }: TextMessagePartProps) {
  const navigate = useContext(GuideNavigationContext);
  const reportFirstText = useContext(GuideFirstTextContext);
  const evidence = useAuiState((state) =>
    guideEvidenceFromMetadata(state.message.metadata.custom.guide),
  );
  useEffect(() => {
    if (text) reportFirstText();
  }, [reportFirstText, text]);
  return (
    <p className="chat-answer">
      {parseGuideAnswerSegments(text, evidence).map((segment, index) =>
        segment.type === "text" ? (
          segment.text
        ) : (
          <button
            aria-label={`${segment.text} ${segment.evidence.title}`}
            className="portfolio-guide-citation"
            data-register={evidenceRegister(segment.target)}
            key={`${index}-${segment.label}`}
            onClick={() => navigate?.(segment.target, segment.evidence)}
            type="button"
          >
            {segment.text}
          </button>
        ),
      )}
    </p>
  );
}

function GuideUserMessage() {
  return (
    <MessagePrimitive.Root
      className="chat-question"
      data-guide-primitive="message"
    >
      <MessagePrimitive.Content components={{ Text: GuideUserText }} />
    </MessagePrimitive.Root>
  );
}

function GuideUserText({ text }: TextMessagePartProps) {
  return <p>{text}</p>;
}

function GuideAssistantMessage() {
  const answer = useAuiState((state) => messageText(state.message));
  if (!answer) return null;
  return (
    <MessagePrimitive.Root
      className="portfolio-guide-answer"
      data-guide-primitive="message"
    >
      <MessagePrimitive.Content components={{ Text: GuideAssistantText }} />
      <button
        aria-label="Copy answer"
        className="portfolio-guide-copy"
        onClick={() => void navigator.clipboard?.writeText(answer)}
        type="button"
      >
        <GuideControlGlyph kind="copy" />
      </button>
    </MessagePrimitive.Root>
  );
}

function GuideSuggestion({ prompt }: { prompt: string }) {
  return (
    <SuggestionPrimitive.Trigger
      className="portfolio-guide-suggestion"
      data-testid="guide-suggestion"
      send
    >
      <GuideControlGlyph kind="chevron" />
      <span>{prompt}</span>
    </SuggestionPrimitive.Trigger>
  );
}

function guidePromptNode(prompt: GuidePrompt) {
  if (!prompt.evidenceId) return undefined;
  if (prompt.evidenceId.startsWith("node:")) {
    return portfolioWorldNodeById.get(prompt.evidenceId.slice("node:".length));
  }
  if (prompt.evidenceId.startsWith("thread:")) {
    const thread = portfolioThreadById.get(
      prompt.evidenceId.slice("thread:".length),
    );
    return portfolioWorldNodeById.get(thread?.nodeId ?? "");
  }
  return undefined;
}

function GuideInitialSuggestion({ prompt }: { prompt: GuidePrompt }) {
  const node = guidePromptNode(prompt);
  return (
    <ThreadPrimitive.Suggestion
      className="portfolio-guide-suggestion"
      data-testid="guide-suggestion"
      prompt={prompt.text}
      send
    >
      {node ? (
        <PortfolioNodeMark family={node.family} register={node.register} />
      ) : (
        <span aria-hidden="true" className="portfolio-guide-suggestion-mark" />
      )}
      <span>{prompt.text}</span>
    </ThreadPrimitive.Suggestion>
  );
}

function waitForWord(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, 45);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function cumulativeWords(answer: string) {
  const words = answer.match(/\S+\s*/g) ?? [];
  let cumulative = "";
  return words.map((word) => {
    cumulative += word;
    return cumulative;
  });
}

function runSafely(work: (() => void | Promise<void>) | undefined) {
  if (!work) return Promise.resolve();
  try {
    return Promise.resolve(work()).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

function GuideThreadStateReporter({
  onThreadStateChange,
}: {
  onThreadStateChange?: (hasThread: boolean) => void;
}) {
  const hasThread = useAuiState((state) => state.thread.messages.length > 0);
  useEffect(() => {
    onThreadStateChange?.(hasThread);
  }, [hasThread, onThreadStateChange]);
  return null;
}

export function PortfolioChat({
  avatarIntegration,
  onLayoutChange,
  onNavigateEvidence,
  onThreadStateChange,
  registerAvatarDock,
  resetSignal = 0,
  askPortfolio = streamPortfolioAnswer,
  renderTurnstile: renderTurnstileWidget = renderTurnstile,
  turnstileSiteKey,
}: PortfolioChatProps) {
  const composerPlaceholder = useEditableContent(
    "interface.chat.composerPlaceholder",
    portfolioInterfaceText["chat.composerPlaceholder"],
  );
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeMessage, setChallengeMessage] = useState("");
  const [failedQuestion, setFailedQuestion] = useState<{
    question: string;
    canRetry: boolean;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const askPortfolioRef = useRef(askPortfolio);
  const avatarIntegrationRef = useRef(avatarIntegration);
  const challengeTokenRef = useRef(challengeToken);
  const conversation = useRef<PortfolioChatMessage[]>([]);
  const visitSeed = useSyncExternalStore(
    subscribeGuideVisitSeed,
    getBrowserGuideVisitSeed,
    getServerGuideVisitSeed,
  );
  const visitState = useRef<PortfolioChatVisitState>({
    generalTurns: 0,
    portfolioNudgeShown: false,
  });
  const retryAttempt = useRef(false);
  const activeRun = useRef<symbol | null>(null);
  const avatarElement = useRef<HTMLDivElement | null>(null);
  const compositionEndTimer = useRef<number | null>(null);
  const compositionJustEnded = useRef(false);
  const firstTextWaiter = useRef<{
    resolve: () => void;
    run: symbol;
  } | null>(null);
  const turnstileContainer = useRef<HTMLDivElement | null>(null);
  const turnstileController = useRef<TurnstileController | null>(null);
  const previousResetSignal = useRef(resetSignal);

  useEffect(() => {
    askPortfolioRef.current = askPortfolio;
    avatarIntegrationRef.current = avatarIntegration;
    challengeTokenRef.current = challengeToken;
  }, [askPortfolio, avatarIntegration, challengeToken]);

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async *run({ messages, abortSignal }) {
        const latestMessage = messages.at(-1);
        const question = latestMessage?.role === "user"
          ? messageText(latestMessage).trim()
          : "";
        if (!question) return;

        const run = Symbol("portfolio-guide-run");
        activeRun.current = run;
        const isRetry = retryAttempt.current;
        retryAttempt.current = false;
        const challenge = challengeTokenRef.current ?? undefined;
        const conversationAtStart = conversation.current;
        const visitStateAtStart = { ...visitState.current };
        const integration = avatarIntegrationRef.current;
        let answer = "";
        let evidence: PortfolioGroundingEvidence[] = [];
        let failed = false;
        let completed = false;
        let turnMode: PortfolioChatTurnMode | undefined;
        let avatarWork = runSafely(() => integration?.onTurnStart());
        const effects: PortfolioResponseEffects[] = [];
        const isCurrent = () =>
          !abortSignal.aborted && activeRun.current === run;
        const queueAvatar = (work: (() => void | Promise<void>) | undefined) => {
          avatarWork = avatarWork.then(() =>
            isCurrent() ? runSafely(work) : undefined,
          );
        };

        setFailedQuestion(null);
        setNotice("");
        setPending(true);
        setSlow(false);
        const slowTimer = window.setTimeout(() => {
          if (isCurrent()) setSlow(true);
        }, 10_000);
        const finishRun = async () => {
          window.clearTimeout(slowTimer);
          await avatarWork;
          if (!isCurrent()) return;
          activeRun.current = null;
          setPending(false);
          setSlow(false);
          if (turnstileSiteKey) {
            setChallengeToken(null);
            turnstileController.current?.reset();
          }
        };

        try {
          await askPortfolioRef.current(question, {
            signal: abortSignal,
            ...(conversationAtStart.length
              ? { conversation: conversationAtStart }
              : {}),
            visitState: visitStateAtStart,
            ...(challenge ? { challengeToken: challenge } : {}),
            onEvent(event) {
              if (!isCurrent()) return;
              if (event.type === "evidence") {
                evidence = [...event.evidence];
              } else if (event.type === "turn_mode") {
                turnMode = event.mode;
              } else if (event.type === "answer_delta") {
                answer += event.delta;
              } else if (event.type === "effects") {
                effects.push(event.effects);
              } else if (event.type === "notice") {
                setNotice(event.message);
              } else if (event.type === "error") {
                failed = true;
              } else if (event.type === "done") {
                completed = true;
              }
            },
          });
        } catch {
          failed = true;
        }

        if (!isCurrent()) return;
        if (failed) {
          setFailedQuestion({ question, canRetry: !isRetry });
          await finishRun();
          yield {
            content: [],
            status: { type: "incomplete", reason: "error" },
          };
          return;
        }
        if (!completed || !answer.trim()) {
          await finishRun();
          yield {
            content: [],
            status: completed
              ? { type: "complete", reason: "stop" }
              : { type: "incomplete", reason: "other" },
          };
          return;
        }

        window.clearTimeout(slowTimer);
        setSlow(false);
        const citedEvidence = Array.from(
          new Map(
            parseGuideAnswerSegments(answer, evidence)
              .filter((segment) => segment.type === "citation")
              .map((segment) => [segment.evidence.id, segment.evidence]),
          ).values(),
        );
        const metadata: GuideMessageMetadata = { citedEvidence, evidence };
        const reveals = cumulativeWords(answer);
        const firstTextRendered = new Promise<void>((resolve) => {
          let settled = false;
          const resolveOnce = () => {
            if (settled) return;
            settled = true;
            if (firstTextWaiter.current?.run === run) {
              firstTextWaiter.current = null;
            }
            resolve();
          };
          firstTextWaiter.current = { resolve: resolveOnce, run };
          abortSignal.addEventListener("abort", resolveOnce, { once: true });
        });
        for (let index = 0; index < reveals.length; index += 1) {
          if (!isCurrent()) return;
          yield {
            content: [{ type: "text", text: reveals[index]! }],
            metadata: { custom: { guide: metadata } },
          };
          if (index === 0) {
            await firstTextRendered;
            if (!isCurrent()) return;
            queueAvatar(() => integration?.onFirstText());
            for (const effect of effects) {
              queueAvatar(() => integration?.onEffects(effect));
            }
          }
          if (index < reveals.length - 1) await waitForWord(abortSignal);
        }

        if (!isCurrent()) return;
        conversation.current = appendPortfolioChatTurn(
          conversation.current,
          question,
          answer,
        );
        if (turnMode === "general") {
          const showsNudge =
            visitStateAtStart.generalTurns >= 2 &&
            !visitStateAtStart.portfolioNudgeShown;
          visitState.current = {
            generalTurns: Math.min(2, visitStateAtStart.generalTurns + 1),
            portfolioNudgeShown:
              visitStateAtStart.portfolioNudgeShown || showsNudge,
          };
        }
        await finishRun();
      },
    }),
    [turnstileSiteKey],
  );

  const suggestionAdapter = useMemo(
    () => ({
      async generate({ messages }: { messages: readonly { metadata: { custom: Record<string, unknown> } }[] }) {
        const lastEvidence = guideEvidenceFromMetadata(
          messages.at(-1)?.metadata.custom.guide,
          "citedEvidence",
        );
        const prompts = messages.length
          ? getGuideFollowUpPrompts(lastEvidence)
          : getGuideInitialPrompts(visitSeed);
        return prompts.map(({ text }) => ({ prompt: text }));
      },
    }),
    [visitSeed],
  );

  const runtime = useLocalRuntime(adapter, {
    adapters: { suggestion: suggestionAdapter },
  });

  useEffect(() => {
    const finish = () => {
      window.clearTimeout(compositionEndTimer.current ?? undefined);
      activeRun.current = null;
      runtime.thread.cancelRun();
    };
    return finish;
  }, [runtime]);

  /* eslint-disable react-hooks/set-state-in-effect -- resetSignal is an imperative
     new-conversation boundary; the effect must clear assistant-ui and local UI
     state in the same commit after the parent advances it. */
  useEffect(() => {
    if (previousResetSignal.current === resetSignal) return;
    previousResetSignal.current = resetSignal;
    activeRun.current = null;
    runtime.thread.cancelRun();
    runtime.thread.reset();
    runtime.thread.composer.setText("");
    conversation.current = [];
    visitState.current = { generalTurns: 0, portfolioNudgeShown: false };
    retryAttempt.current = false;
    setFailedQuestion(null);
    setNotice("");
    setPending(false);
    setSlow(false);
    if (turnstileSiteKey) {
      setChallengeToken(null);
      turnstileController.current?.reset();
    }
    onThreadStateChange?.(false);
  }, [onThreadStateChange, resetSignal, runtime, turnstileSiteKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const updateOnlineState = () => setOffline(!navigator.onLine);
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!onLayoutChange || !avatarElement.current) return;
    const observer = new ResizeObserver(onLayoutChange);
    observer.observe(avatarElement.current);
    return () => observer.disconnect();
  }, [onLayoutChange]);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileContainer.current) return;
    let active = true;
    setChallengeMessage(portfolioInterfaceText["chat.verificationPreparing"]);
    void renderTurnstileWidget(turnstileContainer.current, turnstileSiteKey, {
      onToken(token) {
        if (!active) return;
        setChallengeToken(token);
        setChallengeMessage("");
      },
      onError() {
        if (!active) return;
        setChallengeToken(null);
        setChallengeMessage(portfolioInterfaceText["chat.verificationUnavailable"]);
      },
      onExpired() {
        if (!active) return;
        setChallengeToken(null);
        setChallengeMessage(portfolioInterfaceText["chat.verificationRequired"]);
      },
    })
      .then((controller) => {
        if (!active) {
          controller.remove();
          return;
        }
        turnstileController.current = controller;
      })
      .catch(() => {
        if (active) {
          setChallengeMessage(portfolioInterfaceText["chat.verificationUnavailable"]);
        }
      });
    return () => {
      active = false;
      turnstileController.current?.remove();
      turnstileController.current = null;
    };
  }, [renderTurnstileWidget, turnstileSiteKey]);

  const setAvatarElement = useCallback(
    (element: HTMLDivElement | null) => {
      avatarElement.current = element;
      registerAvatarDock?.(element);
    },
    [registerAvatarDock],
  );

  const reportFirstText = useCallback(() => {
    firstTextWaiter.current?.resolve();
  }, []);

  function guardComposerKey(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (
      event.nativeEvent.isComposing ||
      event.keyCode === 229 ||
      compositionJustEnded.current ||
      offline ||
      (turnstileSiteKey && !challengeToken)
    ) {
      event.preventDefault();
      if (turnstileSiteKey && !challengeToken) {
        setChallengeMessage(portfolioInterfaceText["chat.verificationRequired"]);
      }
    }
  }

  function retry() {
    if (!failedQuestion?.canRetry) return;
    const userMessage = [...runtime.thread.getState().messages]
      .reverse()
      .find((message) => message.role === "user");
    if (!userMessage) return;
    retryAttempt.current = true;
    setFailedQuestion({ ...failedQuestion, canRetry: false });
    runtime.thread.startRun({ parentId: userMessage.id });
  }

  const composerDisabled = offline || pending;
  const initialPrompts = getGuideInitialPrompts(visitSeed);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <GuideNavigationContext.Provider value={onNavigateEvidence}>
        <GuideFirstTextContext.Provider value={reportFirstText}>
          <section
          aria-label="Portfolio Guide"
          className="portfolio-chat"
          data-clarity-mask="true"
          data-offline={offline ? "true" : "false"}
          data-pending={pending ? "true" : "false"}
        >
          <GuideThreadStateReporter onThreadStateChange={onThreadStateChange} />
          <div
            aria-hidden="true"
            className="portfolio-guide-avatar"
            ref={setAvatarElement}
          />
          <ThreadPrimitive.Root
            className="portfolio-chat-thread"
            data-guide-primitive="thread"
          >
            <ThreadPrimitive.Viewport autoScroll>
              <ThreadPrimitive.Messages
                components={{
                  AssistantMessage: GuideAssistantMessage,
                  UserMessage: GuideUserMessage,
                }}
              />
              <ThreadPrimitive.Empty>
                <div className="portfolio-guide-suggestions">
                  {initialPrompts.map((prompt) => (
                    <GuideInitialSuggestion key={prompt.text} prompt={prompt} />
                  ))}
                </div>
              </ThreadPrimitive.Empty>
              {slow ? (
                <div className="portfolio-guide-slow" role="status">
                  <span aria-hidden="true" className="portfolio-guide-twirl" />
                  <span>Still thinking. The records are long.</span>
                </div>
              ) : null}
              {failedQuestion ? (
                <p className="portfolio-guide-error">
                  Something went wrong.{" "}
                  {failedQuestion.canRetry ? (
                    <button onClick={retry} type="button">Try again</button>
                  ) : null}
                </p>
              ) : null}
              {notice ? <p className="portfolio-guide-notice">{notice}</p> : null}
              <div className="portfolio-guide-suggestions">
                <ThreadPrimitive.Suggestions>
                  {({ suggestion }) => (
                    <GuideSuggestion prompt={suggestion.prompt} />
                  )}
                </ThreadPrimitive.Suggestions>
              </div>
            </ThreadPrimitive.Viewport>
          </ThreadPrimitive.Root>
          {turnstileSiteKey ? (
            <div
              aria-label="Security verification"
              className="chat-turnstile"
              role="group"
            >
              <div ref={turnstileContainer} />
              {challengeMessage ? <p className="chat-note">{challengeMessage}</p> : null}
            </div>
          ) : null}
          <ComposerPrimitive.Root
            className="portfolio-chat-composer"
            data-guide-primitive="composer"
          >
            <label className="sr-only" htmlFor="portfolio-question">
              Ask a question about the portfolio
            </label>
            <ComposerPrimitive.Input
              aria-label="Ask a question about the portfolio"
              disabled={composerDisabled}
              id="portfolio-question"
              maxRows={3}
              name="question"
              onChange={onLayoutChange}
              onCompositionEnd={() => {
                compositionJustEnded.current = true;
                compositionEndTimer.current = window.setTimeout(() => {
                  compositionJustEnded.current = false;
                  compositionEndTimer.current = null;
                }, 0);
              }}
              onCompositionStart={() => {
                compositionJustEnded.current = false;
                window.clearTimeout(compositionEndTimer.current ?? undefined);
                compositionEndTimer.current = null;
              }}
              onHeightChange={onLayoutChange}
              onKeyDown={guardComposerKey}
              placeholder={offline ? "The Guide is offline" : composerPlaceholder}
              rows={1}
              submitMode="enter"
            />
            <ComposerPrimitive.Send
              aria-label={pending ? "Asking…" : "Ask"}
              className="portfolio-guide-send"
              disabled={composerDisabled || Boolean(turnstileSiteKey && !challengeToken)}
            >
              <GuideControlGlyph kind="send" />
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
          </section>
        </GuideFirstTextContext.Provider>
      </GuideNavigationContext.Provider>
    </AssistantRuntimeProvider>
  );
}
