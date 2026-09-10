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
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  openPortfolioChatSession,
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
  parseGuideAnswerSegments,
  type GuideEvidenceTarget,
} from "../lib/portfolio-guide-citations";
import {
  getGuideFollowUpPrompts,
  getGuideInitialPrompts,
  type GuidePrompt,
} from "../lib/portfolio-guide-prompts";
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
import { PortfolioControlGlyph, PortfolioControlMark, PortfolioNodeMark } from "./PortfolioNodeMark";

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
  openSession?: () => Promise<boolean>;
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
  const element = useRef<HTMLDivElement | null>(null);
  const openingScrollCancelled = useRef(false);
  const isFirstQuestion = useAuiState(state => state.message.index === 0 && state.thread.messages.length <= 2);
  const openingReplyStarted = useAuiState(state =>
    state.thread.messages[1]?.content.some(part => part.type === "text" && part.text.trim()) ?? false,
  );
  useEffect(() => {
    // assistant-ui top anchoring excludes the first question. Keep its reply
    // visible while the mobile pane settles, then stop at the first text.
    const question = element.current;
    const viewport = question?.closest<HTMLElement>(".portfolio-chat-viewport");
    if (!isFirstQuestion || !question || !viewport || openingScrollCancelled.current) return;
    let frame = 0;
    const align = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (openingScrollCancelled.current || question.offsetHeight <= 96) return;
        const top = viewport.scrollTop + question.getBoundingClientRect().top
          - viewport.getBoundingClientRect().top + question.offsetHeight - 96;
        viewport.scrollTo({ top, behavior: "instant" });
      });
    };
    const cancel = () => { openingScrollCancelled.current = true; };
    viewport.addEventListener("wheel", cancel, { passive: true });
    viewport.addEventListener("touchstart", cancel, { passive: true });
    viewport.addEventListener("pointerdown", cancel);
    viewport.addEventListener("keydown", cancel);
    const observer = new ResizeObserver(align);
    if (!openingReplyStarted) {
      observer.observe(viewport);
      observer.observe(question);
    }
    align();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport.removeEventListener("wheel", cancel);
      viewport.removeEventListener("touchstart", cancel);
      viewport.removeEventListener("pointerdown", cancel);
      viewport.removeEventListener("keydown", cancel);
    };
  }, [isFirstQuestion, openingReplyStarted]);
  return (
    <MessagePrimitive.Root
      className="chat-question"
      data-guide-primitive="message"
      ref={element}
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
        <PortfolioControlGlyph kind="copy" size="compact" />
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
  const metadata = useAuiState((state) => state.thread.messages.at(-1)?.metadata.custom.guide);
  const citedEvidence = guideEvidenceFromMetadata(metadata, "citedEvidence");
  const guidePrompt = getGuideFollowUpPrompts(citedEvidence).find(candidate => candidate.text === prompt);
  return (
    <SuggestionPrimitive.Trigger
      className="portfolio-guide-suggestion"
      data-testid="guide-suggestion"
      data-game-suggestion={prompt === "Play Brain Food"}
      disabled={disabled}
      send
    >
      <GuideSuggestionMark prompt={guidePrompt} />
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

function GuideSuggestionMark({ prompt }: { prompt?: GuidePrompt }) {
  const node = prompt ? guidePromptNode(prompt) : undefined;
  return (
    <PortfolioNodeMark
      family={node?.family ?? "identity"}
      register={node?.register ?? "identity"}
    />
  );
}

function GuideInitialSuggestion({
  disabled,
  prompt,
}: {
  disabled: boolean;
  prompt: GuidePrompt;
}) {
  return (
    <ThreadPrimitive.Suggestion
      className="portfolio-guide-suggestion"
      data-testid="guide-suggestion"
      data-game-suggestion={prompt.text === "Play Brain Food"}
      disabled={disabled}
      prompt={prompt.text}
      send
    >
      <GuideSuggestionMark prompt={prompt} />
      <span>{prompt.text}</span>
    </ThreadPrimitive.Suggestion>
  );
}

/** How long a quiet run waits before it reassures, and before it gives up. */
const slowNoticeMs = 4_000;
const stallTimeoutMs = 20_000;

function isGuideSubmissionEligible({ online }: { online: boolean }) {
  return online;
}

function runSafely(work: (() => void | Promise<void>) | undefined) {
  if (!work) return Promise.resolve();
  try {
    return Promise.resolve(work()).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

/**
 * "Ask a follow-up" is a lie on an empty thread — there is nothing to follow.
 * The placeholder has to read the thread, which only works inside the runtime
 * provider, so the input carries its own component.
 */
function GuideComposerInput({
  emptyPlaceholder,
  followUpPlaceholder,
  offlinePlaceholder,
  offline,
  ...props
}: Omit<
  Extract<
    ComponentProps<typeof ComposerPrimitive.Input>,
    { submitOnEnter?: never }
  >,
  "placeholder" | "submitMode"
> & {
  emptyPlaceholder: string;
  followUpPlaceholder: string;
  offlinePlaceholder: string;
  offline: boolean;
}) {
  const hasMessages = useAuiState((state) => state.thread.messages.length > 0);
  return (
    <ComposerPrimitive.Input
      {...props}
      submitMode="enter"
      placeholder={
        offline
          ? offlinePlaceholder
          : hasMessages
            ? followUpPlaceholder
            : emptyPlaceholder
      }
    />
  );
}

function GuideFollowUps({ children }: { children: ReactNode }) {
  const hasMessages = useAuiState(state => state.thread.messages.length > 0);
  return hasMessages ? children : null;
}

function GuideViewport({ children }: { children: ReactNode }) {
  return (
    <ThreadPrimitive.Viewport
      autoScroll={false}
      className="portfolio-chat-viewport"
      scrollToBottomOnInitialize={false}
      scrollToBottomOnRunStart={false}
      scrollToBottomOnThreadSwitch={false}
      turnAnchor="top"
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
  openSession = openPortfolioChatSession,
}: PortfolioChatProps) {
  const composerPlaceholder = portfolioInterfaceText["chat.composerPlaceholder"];
  const openingPlaceholder =
    portfolioInterfaceText["chat.composerPlaceholderOpening"];
  const [failedQuestion, setFailedQuestion] = useState<{
    question: string;
    canRetry: boolean;
    code?: string;
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
  const [hasResponse, setHasResponse] = useState(false);
  const askPortfolioRef = useRef(askPortfolio);
  const avatarIntegrationRef = useRef(avatarIntegration);
  const availabilityRef = useRef(actionAvailability);
  const [composerText, setComposerText] = useState("");
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
  const previousResetSignal = useRef(resetSignal);

  useEffect(() => {
    askPortfolioRef.current = askPortfolio;
    avatarIntegrationRef.current = avatarIntegration;
    availabilityRef.current = actionAvailability;
  }, [askPortfolio, avatarIntegration, actionAvailability]);

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
          online: typeof navigator === "undefined" || navigator.onLine,
        })) {
          // Eligibility lapsed between the UI check and the send. assistant-ui
          // has already committed the user message, so mark the turn failed
          // (with its retry intact) rather than leave an unanswered bubble.
          retryAttempt.current = false;
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
        setHasResponse(false);
        const slowTimer = window.setTimeout(() => {
          if (isCurrent()) setSlow(true);
        }, slowNoticeMs);
        const stallController = new AbortController();
        let stallTimer = 0;
        const finishRun = async () => {
          window.clearTimeout(slowTimer);
          window.clearTimeout(stallTimer);
          await avatarWork;
          if (!isCurrent()) return;
          activeRun.current = null;
          setPending(false);
          setSlow(false);
        };

        let failureCode = "request_failed";
        let settled = false;
        let revision = 0;
        let wake: (() => void) | undefined;
        const notify = () => { revision += 1; wake?.(); };
        // A stream that stops producing without ever closing would otherwise
        // leave the composer disabled under a spinner forever. The worker has
        // its own, shorter deadline; this only catches a wedged connection.
        const resetStallTimer = () => {
          window.clearTimeout(stallTimer);
          stallTimer = window.setTimeout(() => {
            if (!isCurrent()) return;
            failed = true;
            failureCode = "stalled";
            stallController.abort();
            notify();
          }, stallTimeoutMs);
        };
        resetStallTimer();
        const receive: Parameters<AskPortfolio>[1]["onEvent"] = (event) => {
          if (!isCurrent() || failed) return;
          if (event.type === "evidence") evidence = [...event.evidence];
          else if (event.type === "turn_mode") turnMode = event.mode;
          else if (event.type === "answer_delta") {
            answer += event.delta;
            if (event.delta) resetStallTimer();
          }
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
            signal: AbortSignal.any([abortSignal, stallController.signal]),
            ...(conversationAtStart.length ? { conversation: conversationAtStart } : {}),
            visitState: visitStateAtStart,
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
              setHasResponse(true);
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
          window.clearTimeout(stallTimer);
        }
        if (!isCurrent()) return;
        if (failed || !completed || !answer.trim()) {
          const errors: Record<string, { message: string; retry: boolean }> = {
            budget_exhausted: { message: "Chat has reached its daily allowance. Please come back tomorrow. You can still explore and use the play controls.", retry: false },
            rate_limited: { message: "Please wait a minute before asking again. You can still use the play controls.", retry: true },
            misconfigured: { message: "Chat is temporarily unavailable. You can still explore the portfolio and use the play controls.", retry: false },
            session_required: { message: "Could not finish that reply.", retry: true },
            stalled: { message: "That reply took too long to arrive.", retry: true },
          };
          const error = errors[failureCode] ?? { message: "Could not finish that reply.", retry: true };
          setFailedQuestion({ question, canRetry: !isRetry && error.retry, code: failureCode, message: error.message });
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
    [],
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
    onThreadStateChange?.(false);
  }, [onThreadStateChange, resetSignal, runtime]);

  useEffect(() => {
    if (!onLayoutChange || !avatarElement.current) return;
    const observer = new ResizeObserver(onLayoutChange);
    observer.observe(avatarElement.current);
    return () => observer.disconnect();
  }, [onLayoutChange]);

  // The endpoint asks for a session token. Establishing it on mount means the
  // cookie is already in place before anyone types, so the first question is no
  // slower than the rest. A failure is not fatal: the send re-establishes it.
  useEffect(() => {
    void openSession();
  }, [openSession]);

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

  const remoteSubmissionEligible = isGuideSubmissionEligible({ online: !offline });

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

  const secureSessionUrl = failedQuestion?.code === "session_required"
    && typeof location !== "undefined"
    && location.protocol === "http:"
    && !["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(location.hostname)
    && !location.hostname.endsWith(".localhost")
    ? location.href.replace(/^http:/, "https:")
    : null;

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
            <PortfolioControlMark
              aria-label={actionAvailability.status === "hidden" ? "Show avatar" : "Hide avatar"}
              aria-pressed={!(actionAvailability.status === "hidden")}
              className="portfolio-guide-avatar-toggle"
              kind={actionAvailability.status === "hidden" ? "avatarHidden" : "avatarShown"}
              onClick={onToggleAvatar}
            />
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
              {pending && !hasResponse ? (
                <div className="portfolio-guide-slow" role="status">
                  <span aria-hidden="true" className="portfolio-guide-twirl" />
                  <span>{slow ? "Thinking long and hard…" : "Thinking…"}</span>
                </div>
              ) : null}
              {failedQuestion ? (
                <p className="portfolio-guide-error">
                  {secureSessionUrl ? "Chat needs a secure connection." : failedQuestion.message ?? "Could not finish that reply."}{" "}
                  {secureSessionUrl ? <a href={secureSessionUrl}>Open the secure site</a> : failedQuestion.canRetry ? (
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
            </GuideViewport>
          </ThreadPrimitive.Root>
          <ComposerPrimitive.Root
            className="portfolio-chat-composer"
            data-guide-primitive="composer"
          >
            <label className="sr-only" htmlFor="portfolio-question">
              Ask a question about the portfolio
            </label>
            <GuideComposerInput
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
              emptyPlaceholder={openingPlaceholder}
              followUpPlaceholder={composerPlaceholder}
              offlinePlaceholder="Chat is offline"
              offline={offline}
              rows={1}
            />
            <ComposerPrimitive.Send
              aria-label={pending ? "Asking…" : "Ask"}
              className="portfolio-guide-send"
              disabled={pending || !submissionEligible}
            >
              <PortfolioControlGlyph kind="send" size="inline" />
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
          </section>
        </GuideFirstTextContext.Provider>
      </GuideNavigationContext.Provider>
    </AssistantRuntimeProvider>
  );
}
