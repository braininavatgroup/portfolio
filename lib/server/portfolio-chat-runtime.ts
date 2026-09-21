import { createOpenAIPortfolioProvider } from "./openai-portfolio-provider";
import {
  createPortfolioChatLaunchGuard,
  deriveActorKey,
  type PortfolioChatLaunchEvent,
  type PortfolioChatRateLimiter,
  type PortfolioChatRuntimeConfig,
  type PortfolioChatSession,
} from "./portfolio-chat-launch";
import {
  mintSession,
  sessionHeaderName,
} from "./portfolio-chat-session";
import {
  createPortfolioChatHandler,
  parsePortfolioChatRequest,
  type PortfolioChatStreamEvent,
} from "./portfolio-chat-handler";
import type { PortfolioChatProvider } from "./portfolio-chat-provider";
import {
  createChatTranscriptKeeper,
  type ChatTranscriptEnv,
} from "./portfolio-chat-transcripts";
import { groundPortfolioQuestion } from "../portfolio-grounding";

export type PortfolioChatBudgetStub = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type PortfolioChatBudgetNamespace = {
  getByName(name: string): PortfolioChatBudgetStub;
};

export type PortfolioChatRuntimeEnv = {
  PORTFOLIO_CHAT_IDENTIFIER_SECRET?: string;
  PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT?: string;
  PORTFOLIO_CHAT_SESSION_REQUIRED?: string;
  OPENAI_API_KEY?: string;
  OPENAI_PORTFOLIO_MODEL?: string;
  OPENAI_PORTFOLIO_REASONING_EFFORT?: string;
  OPENAI_PORTFOLIO_VERBOSITY?: string;
  PORTFOLIO_CHAT_RATE_LIMITER?: PortfolioChatRateLimiter;
  PORTFOLIO_CHAT_BUDGET?: PortfolioChatBudgetNamespace;
} & ChatTranscriptEnv;

type RuntimeEvent = PortfolioChatLaunchEvent | PortfolioChatStreamEvent;

type PortfolioChatRuntimeOptions = {
  env: PortfolioChatRuntimeEnv;
  fetchImplementation?: typeof fetch;
  getProvider?: () => PortfolioChatProvider;
  now?: () => number;
  randomId?: () => string;
  record?: (event: RuntimeEvent) => void;
  /** The Worker's `waitUntil`, so a transcript write outlives the response. */
  waitUntil?: (work: Promise<unknown>) => void;
};

const reasoningEfforts = new Set([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

const verbosities = new Set(["low", "medium", "high"]);

type Verbosity = "low" | "medium" | "high";

type ReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

function positiveInteger(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function runtimeConfig(env: PortfolioChatRuntimeEnv): PortfolioChatRuntimeConfig {
  return {
    identifierSecret: env.PORTFOLIO_CHAT_IDENTIFIER_SECRET,
    dailyRequestLimit: positiveInteger(env.PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT),
    sessionRequired: env.PORTFOLIO_CHAT_SESSION_REQUIRED === "true",
  };
}

function jsonResponse(status: number, body: object) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * Republishes the response with the renewed session. The body is passed through
 * untouched so the answer keeps streaming.
 */
function withSession(response: Response, session?: PortfolioChatSession) {
  if (!session) return response;
  const headers = new Headers(response.headers);
  headers.set(sessionHeaderName, String(session.expiresAt));
  headers.append("set-cookie", session.setCookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function configuredProvider(env: PortfolioChatRuntimeEnv) {
  const effort = env.OPENAI_PORTFOLIO_REASONING_EFFORT;
  return (
    Boolean(env.OPENAI_API_KEY) &&
    Boolean(env.OPENAI_PORTFOLIO_MODEL) &&
    Boolean(env.PORTFOLIO_CHAT_BUDGET) &&
    Boolean(positiveInteger(env.PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT)) &&
    (!effort || reasoningEfforts.has(effort)) &&
    (!env.OPENAI_PORTFOLIO_VERBOSITY ||
      verbosities.has(env.OPENAI_PORTFOLIO_VERBOSITY))
  );
}

async function consumeProviderBudget(
  namespace: PortfolioChatBudgetNamespace,
  limit: number,
) {
  try {
    const stub = namespace.getByName("portfolio-chat-global-budget");
    const response = await stub.fetch("https://portfolio-chat-budget/consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit }),
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      return false;
    }
    const result: unknown = await response.json();
    return (
      result !== null &&
      typeof result === "object" &&
      Reflect.get(result, "success") === true
    );
  } catch {
    return false;
  }
}

export function createPortfolioChatRuntime({
  env,
  fetchImplementation = fetch,
  getProvider,
  now = Date.now,
  randomId = () => crypto.randomUUID(),
  record = (event) => console.info(JSON.stringify(event)),
  waitUntil,
}: PortfolioChatRuntimeOptions) {
  const config = runtimeConfig(env);
  const safeRecord = (event: RuntimeEvent) => {
    try {
      record(event);
    } catch {
      // Operational logging must not change the request outcome.
    }
  };
  const guard = createPortfolioChatLaunchGuard({
    config,
    rateLimiter: env.PORTFOLIO_CHAT_RATE_LIMITER,
    randomId,
    record: safeRecord,
    now,
  });

  return {
    /**
     * Issues the token the chat endpoint asks for. The Guide calls this once on
     * mount so the cookie is in place before anyone types, and the first
     * question is no slower than the rest.
     */
    async handleSession(request: Request) {
      if (!config.sessionRequired) {
        return jsonResponse(200, { required: false });
      }
      const connectingIp = request.headers.get("cf-connecting-ip");
      if (!connectingIp || (config.identifierSecret?.length ?? 0) < 32) {
        return jsonResponse(503, {
          code: "misconfigured",
          message: "Ask the portfolio is not configured.",
        });
      }
      // The Guide calls this before anyone types, so an unexpected failure here
      // is the visitor's first impression. Contained, it is the same designed
      // 503 the chat guard returns; uncontained, it escapes the Worker and
      // Cloudflare answers with its own error page instead.
      try {
        const actorKey = await deriveActorKey(
          config.identifierSecret,
          connectingIp,
        );
        const session = await mintSession({
          secret: config.identifierSecret!,
          actorKey,
          now: now(),
        });
        return withSession(
          jsonResponse(200, { required: true, expiresAt: session.expiresAt }),
          session,
        );
      } catch (error) {
        safeRecord({
          event: "portfolio_chat_preflight",
          requestId: randomId(),
          outcome: "misconfigured",
          cause: error instanceof Error ? error.name : "unknown",
        });
        return jsonResponse(503, {
          code: "misconfigured",
          message: "Ask the portfolio is not configured.",
        });
      }
    },

    async handleChat(request: Request) {
      if (!configuredProvider(env)) {
        safeRecord({
          event: "portfolio_chat_preflight",
          requestId: randomId(),
          outcome: "misconfigured",
        });
        return jsonResponse(503, {
          code: "misconfigured",
          message: "Ask the portfolio is not configured.",
        });
      }

      if (request.method !== "POST") {
        return jsonResponse(405, {
          code: "method_not_allowed",
          message: "That request method is not allowed.",
        });
      }
      const parsed = await parsePortfolioChatRequest(request);
      if (!parsed.ok) return parsed.response;

      const launch = await guard(request);
      if (!launch.ok) return launch.response;
      const grounding = groundPortfolioQuestion(parsed.value.question);
      if (grounding.evidence.length > 0) {
        const budgetAvailable = await consumeProviderBudget(
          env.PORTFOLIO_CHAT_BUDGET!,
          positiveInteger(env.PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT)!,
        );
        if (!budgetAvailable) {
          safeRecord({
            event: "portfolio_chat_preflight",
            requestId: launch.requestId,
            outcome: "budget_exhausted",
          });
          return withSession(
            jsonResponse(503, {
              code: "budget_exhausted",
              message: "The answer service has reached its daily limit.",
            }),
            launch.session,
          );
        }
      }
      const providerFactory =
        getProvider ??
        (() =>
          createOpenAIPortfolioProvider({
            apiKey: env.OPENAI_API_KEY!,
            model: env.OPENAI_PORTFOLIO_MODEL!,
            reasoningEffort: env.OPENAI_PORTFOLIO_REASONING_EFFORT as
              | ReasoningEffort
              | undefined,
            verbosity: env.OPENAI_PORTFOLIO_VERBOSITY as Verbosity | undefined,
            fetchImplementation,
          }));
      const handler = createPortfolioChatHandler({
        getProvider: providerFactory,
        getRequestContext: () => ({
          requestId: launch.requestId,
          safetyIdentifier: launch.safetyIdentifier,
          providerModel: env.OPENAI_PORTFOLIO_MODEL!,
        }),
        now,
        record: safeRecord,
        keepTranscript: createChatTranscriptKeeper({ env, request, now }),
        waitUntil,
      });
      return withSession(
        await handler(request, { ...parsed.value, grounding }),
        launch.session,
      );
    },
  };
}
