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
import { createPortal } from "react-dom";
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
  type ReactNode,
} from "react";
import {
  streamPortfolioAnswer,
  PortfolioChatClientError,
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

import { actionAcknowledgement, actionUnavailableReason, directAvatarRequest, type GuideActionAvailability } from "../lib/portfolio-chat-actions";

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
  actionAvailability?: GuideActionAvailability;
  onToggleAvatar?: () => void;
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

function subscribeConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getOfflineSnapshot = () => !navigator.onLine;
const getOfflineServerSnapshot = () => false;

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
        ) : segment.text === `[E${segment.label}]` ? null : (
          <a
            title={segment.evidence.title}
            className="portfolio-guide-citation"
            data-register={evidenceRegister(segment.target)}
            key={`${index}-${segment.label}`}
            href={segment.target.type === "home" ? "/" : segment.target.type === "thread" ? `/?view=graph#thread/${segment.target.id}` : `/?view=graph#${segment.target.id}`}
            onClick={(event) => {
              if (!navigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              navigate(segment.target, segment.evidence);
            }}
          >
            {segment.text}
          </a>
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
        onClick={() => void navigator.clipboard?.writeText(answer.replace(/\[(?!E[1-9]\d*\])([^\]\n]+)\]\[E[1-9]\d*\]/g, "$1").replace(/\s*\[E[1-9]\d*\]/g, ""))}
        type="button"
      >
        <GuideControlGlyph kind="copy" />
      </button>
    </MessagePrimitive.Root>
  );
}

function GuideSuggestion({
  disabled,
  prompt,
}: {
  disabled: boolean;
  prompt: string;
}) {
  return (
    <SuggestionPrimitive.Trigger
      className="portfolio-guide-suggestion"
      data-testid="guide-suggestion"
      data-game-suggestion={prompt === "Play Brain Food"}
      disabled={disabled}
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

function GuideInitialSuggestion({
  disabled,
  prompt,
}: {
  disabled: boolean;
  prompt: GuidePrompt;
}) {
  const node = guidePromptNode(prompt);
  return (
    <ThreadPrimitive.Suggestion
      className="portfolio-guide-suggestion"
      data-testid="guide-suggestion"
      data-game-suggestion={prompt.text === "Play Brain Food"}
      disabled={disabled}
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

function isGuideSubmissionEligible({
  challengeRequired,
  challengeToken,
  online,
}: {
  challengeRequired: boolean;
  challengeToken: string | null;
  online: boolean;
}) {
  return online && (!challengeRequired || Boolean(challengeToken));
}

function runSafely(work: (() => void | Promise<void>) | undefined) {
  if (!work) return Promise.resolve();
  try {
    return Promise.resolve(work()).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

function GuideFollowUps({ children }: { children: ReactNode }) {
  const hasMessages = useAuiState(state => state.thread.messages.length > 0);
  return hasMessages ? children : null;
}

function GuideViewport({ children }: { children: ReactNode }) {
  const hasMessages = useAuiState((state) => state.thread.messages.length > 0);
  return (
    <ThreadPrimitive.Viewport
      autoScroll={hasMessages}
      className="portfolio-chat-viewport"
      scrollToBottomOnInitialize={hasMessages}
      scrollToBottomOnThreadSwitch={hasMessages}
    >
      {children}
    </ThreadPrimitive.Viewport>
  );
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
  actionAvailability = { status: "ready", reducedMotion: false, gameSupported: true },
  onToggleAvatar,
  onLayoutChange,
  onNavigateEvidence,
  onThreadStateChange,
  registerAvatarDock,
  resetSignal = 0,
  askPortfolio = streamPortfolioAnswer,
  renderTurnstile: renderTurnstileWidget = renderTurnstile,
  turnstileSiteKey,
}: PortfolioChatProps) {
  const composerPlaceholder = portfolioInterfaceText["chat.composerPlaceholder"];
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeMessage, setChallengeMessage] = useState("");
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  const [failedQuestion, setFailedQuestion] = useState<{
    question: string;
    canRetry: boolean;
    message?: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const offline = useSyncExternalStore(
    subscribeConnectivity,
    getOfflineSnapshot,
    getOfflineServerSnapshot,
  );
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const askPortfolioRef = useRef(askPortfolio);
  const avatarIntegrationRef = useRef(avatarIntegration);
  const availabilityRef = useRef(actionAvailability);
  const [composerText, setComposerText] = useState("");
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
    availabilityRef.current = actionAvailability;
    challengeTokenRef.current = challengeToken;
  }, [askPortfolio, avatarIntegration, challengeToken, actionAvailability]);

  const updateChallengeToken = useCallback((token: string | null) => {
    challengeTokenRef.current = token;
    setChallengeToken(token);
  }, []);

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async *run({ messages, abortSignal }) {
        const latestMessage = messages.at(-1);
        const question = latestMessage?.role === "user"
          ? messageText(latestMessage).trim()
          : "";
        if (!question) return;
        const directAction = directAvatarRequest(question);
        if (!directAction && !isGuideSubmissionEligible({
          challengeRequired: Boolean(turnstileSiteKey),
          challengeToken: challengeTokenRef.current,
          online: typeof navigator === "undefined" || navigator.onLine,
        })) {
          // Eligibility lapsed between the UI check and the send. assistant-ui
          // has already committed the user message, so mark the turn failed
          // (with its retry intact) rather than leave an unanswered bubble.
          retryAttempt.current = false;
          if (turnstileSiteKey && !challengeTokenRef.current) {
            setChallengeMessage(portfolioInterfaceText["chat.verificationRequired"]);
          }
          setFailedQuestion({ question, canRetry: true });
          yield {
            content: [],
            status: { type: "incomplete", reason: "error" },
          };
          return;
        }

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
          if (turnstileSiteKey && !directAction) {
            updateChallengeToken(null);
            turnstileController.current?.reset();
          }
        };

        let failureCode = "request_failed";
        let settled = false;
        let revision = 0;
        let wake: (() => void) | undefined;
        const notify = () => { revision += 1; wake?.(); };
        const receive: Parameters<AskPortfolio>[1]["onEvent"] = (event) => {
          if (!isCurrent()) return;
          if (event.type === "evidence") evidence = [...event.evidence];
          else if (event.type === "turn_mode") turnMode = event.mode;
          else if (event.type === "answer_delta") answer += event.delta;
          else if (event.type === "effects") effects.push(event.effects);
          else if (event.type === "notice") setNotice(event.message);
          else if (event.type === "error") { failed = true; failureCode = event.code; }
          else if (event.type === "done") completed = true;
          notify();
        };
        const request = async () => {
          if (directAction) {
            const unavailable = actionUnavailableReason(directAction, availabilityRef.current);
            receive({ type: "turn_mode", mode: "social" });
            receive({ type: "answer_delta", delta: unavailable ?? actionAcknowledgement(directAction) });
            if (!unavailable) receive({ type: "effects", effects: { avatarAction: directAction, issues: [] } });
            receive({ type: "done" });
            return;
          }
          await askPortfolioRef.current(question, {
            signal: abortSignal,
            ...(conversationAtStart.length ? { conversation: conversationAtStart } : {}),
            visitState: visitStateAtStart,
            ...(challenge ? { challengeToken: challenge } : {}),
            onEvent: receive,
          });
        };
        void request().catch((error: unknown) => {
          failed = true;
          if (error instanceof PortfolioChatClientError) failureCode = error.code;
        }).finally(() => { settled = true; notify(); });
        abortSignal.addEventListener("abort", notify, { once: true });
        let rendered = false;
        let lastText = "";
        const messageMetadata = (): GuideMessageMetadata => ({
          evidence,
          citedEvidence: Array.from(new Map(parseGuideAnswerSegments(answer, evidence)
            .filter(segment => segment.type === "citation")
            .map(segment => [segment.evidence.id, segment.evidence])).values()),
        });
        try {
          while (isCurrent()) {
            const seen = revision;
            if (failed) break;
            if (answer && answer !== lastText) {
              window.clearTimeout(slowTimer);
              setSlow(false);
              let firstRendered: Promise<void> | undefined;
              if (!rendered) {
                firstRendered = new Promise<void>(resolve => {
                  firstTextWaiter.current = { run, resolve };
                });
              }
              lastText = answer;
              yield { content: [{ type: "text", text: answer }], metadata: { custom: { guide: messageMetadata() } } };
              if (!rendered) {
                // Resolve on the first DOM commit, or cancel if the thread leaves.
                const release = () => firstTextWaiter.current?.run === run && firstTextWaiter.current.resolve();
                abortSignal.addEventListener("abort", release, { once: true });
                if (!isCurrent()) release();
                await firstRendered;
                abortSignal.removeEventListener("abort", release);
                firstTextWaiter.current = null;
                rendered = true;
                queueAvatar(() => integration?.onFirstText());
              }
            }
            if (settled) break;
            if (seen === revision) await new Promise<void>(resolve => { wake = resolve; });
          }
        } finally {
          abortSignal.removeEventListener("abort", notify);
          window.clearTimeout(slowTimer);
        }
        if (!isCurrent()) return;
        if (failed || !completed || !answer.trim()) {
          if (failed || !completed) {
            const errors: Record<string, { message: string; retry: boolean }> = {
              budget_exhausted: { message: "The Guide has reached its daily allowance. Please come back tomorrow. You can still explore and use the play controls.", retry: false },
              rate_limited: { message: "Please wait a minute before asking again. You can still use the play controls.", retry: true },
              misconfigured: { message: "The Guide is temporarily unavailable. You can still explore the portfolio and use the play controls.", retry: false },
              challenge_failed: { message: "Please complete the security check, then try again.", retry: true },
            };
            const error = errors[failureCode] ?? { message: "The Guide could not finish that reply.", retry: true };
            setFailedQuestion({ question, canRetry: !isRetry && error.retry, message: error.message });
          }
          await finishRun();
          yield { content: [], status: { type: "incomplete", reason: "error" } };
          return;
        }
        yield { content: [{ type: "text", text: answer }], metadata: { custom: { guide: messageMetadata() } } };
        for (const effect of effects) {
          const unavailable = effect.avatarAction ? actionUnavailableReason(effect.avatarAction, availabilityRef.current) : null;
          if (unavailable) setNotice(unavailable);
          else queueAvatar(() => integration?.onEffects(effect));
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
    [turnstileSiteKey, updateChallengeToken],
  );

  const suggestionAdapter = useMemo(
    () => ({
      async generate({ messages }: { messages: readonly { metadata: { custom: Record<string, unknown> } }[] }) {
        const lastEvidence = guideEvidenceFromMetadata(
          messages.at(-1)?.metadata.custom.guide,
          "citedEvidence",
        );
        const prompts = messages.length
          ? getGuideFollowUpPrompts(lastEvidence, conversation.current.filter(message => message.role === "user").map(message => message.content))
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
    };
    return finish;
  }, []);

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
      updateChallengeToken(null);
      turnstileController.current?.reset();
    }
    onThreadStateChange?.(false);
  }, [onThreadStateChange, resetSignal, runtime, turnstileSiteKey, updateChallengeToken]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        updateChallengeToken(token);
        setChallengeMessage("");
      },
      onError() {
        if (!active) return;
        updateChallengeToken(null);
        setChallengeMessage(portfolioInterfaceText["chat.verificationUnavailable"]);
      },
      onExpired() {
        if (!active) return;
        updateChallengeToken(null);
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
  }, [challengeAttempt, renderTurnstileWidget, turnstileSiteKey, updateChallengeToken]);

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

  const remoteSubmissionEligible = isGuideSubmissionEligible({
    challengeRequired: Boolean(turnstileSiteKey),
    challengeToken,
    online: !offline,
  });

  const submissionEligible = Boolean(directAvatarRequest(composerText)) || remoteSubmissionEligible;
  const promptAvailable = (text: string) => {
    const action = directAvatarRequest(text);
    return !action || !actionUnavailableReason(action, actionAvailability);
  };
  const promptEligible = (text: string) => Boolean(directAvatarRequest(text)) || remoteSubmissionEligible;

  function guardComposerKey(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (
      event.nativeEvent.isComposing ||
      event.keyCode === 229 ||
      compositionJustEnded.current ||
      !submissionEligible
    ) {
      event.preventDefault();
      if (turnstileSiteKey && !challengeToken) {
        setChallengeMessage(portfolioInterfaceText["chat.verificationRequired"]);
      }
    }
  }

  function retry() {
    if (!submissionEligible || !failedQuestion?.canRetry) return;
    const userMessage = [...runtime.thread.getState().messages]
      .reverse()
      .find((message) => message.role === "user");
    if (!userMessage) return;
    retryAttempt.current = true;
    setFailedQuestion({ ...failedQuestion, canRetry: false });
    runtime.thread.startRun({ parentId: userMessage.id });
  }

  const [scrollControls, setScrollControls] = useState<HTMLDivElement | null>(null);

  const composerDisabled = pending;
  const initialPrompts = getGuideInitialPrompts(visitSeed).filter(prompt => promptAvailable(prompt.text));

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
          {onToggleAvatar ? (
            <button className="portfolio-guide-avatar-toggle" onClick={onToggleAvatar} type="button">
              {actionAvailability.status === "hidden" ? "Show avatar" : "Hide avatar"}
            </button>
          ) : null}
          <ThreadPrimitive.Root
            className="portfolio-chat-thread"
            data-guide-primitive="thread"
          >
            <GuideViewport>
              <div className="portfolio-chat-content">
              <ThreadPrimitive.Messages
                components={{
                  AssistantMessage: GuideAssistantMessage,
                  UserMessage: GuideUserMessage,
                }}
              />
              <ThreadPrimitive.Empty>
                <div className="portfolio-guide-suggestions">
                  {initialPrompts.map((prompt) => (
                    <GuideInitialSuggestion
                      disabled={!promptEligible(prompt.text)}
                      key={prompt.text}
                      prompt={prompt}
                    />
                  ))}
                </div>
              </ThreadPrimitive.Empty>
              {pending ? (
                <div className="portfolio-guide-slow" role="status">
                  <span aria-hidden="true" className="portfolio-guide-twirl" />
                  <span>{slow ? "Still thinking…" : "Thinking…"}</span>
                </div>
              ) : null}
              {failedQuestion ? (
                <p className="portfolio-guide-error">
                  {failedQuestion.message ?? "The Guide could not finish that reply."}{" "}
                  {failedQuestion.canRetry ? (
                    <button
                      disabled={!submissionEligible}
                      onClick={retry}
                      type="button"
                    >
                      Try again
                    </button>
                  ) : null}
                </p>
              ) : null}
              {notice ? <p className="portfolio-guide-notice">{notice}</p> : null}
              <GuideFollowUps><div className="portfolio-guide-suggestions">
                <ThreadPrimitive.Suggestions>
                  {({ suggestion }) => promptAvailable(suggestion.prompt) ? (
                    <GuideSuggestion
                      disabled={!promptEligible(suggestion.prompt)}
                      prompt={suggestion.prompt}
                    />
                  ) : null}
                </ThreadPrimitive.Suggestions>
              </div></GuideFollowUps>
              </div>
              {scrollControls ? createPortal(
                <ThreadPrimitive.ScrollToBottom aria-label="Jump to latest reply" className="portfolio-guide-latest" title="Jump to latest reply"><GuideControlGlyph kind="chevron" /></ThreadPrimitive.ScrollToBottom>,
                scrollControls,
              ) : null}
            </GuideViewport>
            <div className="portfolio-guide-scroll-controls" ref={setScrollControls} />
          </ThreadPrimitive.Root>
          {turnstileSiteKey ? (
            <div
              aria-label="Security verification"
              className="chat-turnstile"
              role="group"
            >
              <div ref={turnstileContainer} />
              {challengeMessage ? <p className="chat-note">{challengeMessage}</p> : null}
              {challengeMessage === portfolioInterfaceText["chat.verificationUnavailable"] ? (
                <button className="chat-verification-retry" onClick={() => setChallengeAttempt((attempt) => attempt + 1)} type="button">
                  Retry verification
                </button>
              ) : null}
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
              onChange={(event) => { setComposerText(event.target.value); onLayoutChange?.(); }}
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
              disabled={pending || !submissionEligible}
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
