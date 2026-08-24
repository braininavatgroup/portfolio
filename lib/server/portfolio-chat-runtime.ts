import { createOpenAIPortfolioProvider } from "./openai-portfolio-provider";
import {
  createPortfolioChatLaunchGuard,
  createPortfolioChatPreviewHandler,
  createTurnstileVerifier,
  type PortfolioChatLaunchEvent,
  type PortfolioChatRateLimiter,
  type PortfolioChatRuntimeConfig,
} from "./portfolio-chat-launch";
import {
  createPortfolioChatHandler,
  parsePortfolioChatRequest,
  type PortfolioChatStreamEvent,
} from "./portfolio-chat-handler";
import type { PortfolioChatProvider } from "./portfolio-chat-provider";
import { groundPortfolioQuestion } from "../portfolio-grounding";

export type PortfolioChatBudgetStub = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type PortfolioChatBudgetNamespace = {
  getByName(name: string): PortfolioChatBudgetStub;
};

export type PortfolioChatRuntimeEnv = {
  PORTFOLIO_CHAT_LIVE_ENABLED?: string;
  PORTFOLIO_CHAT_PREVIEW_ENABLED?: string;
  PORTFOLIO_CHAT_PREVIEW_ACCESS_CODE?: string;
  PORTFOLIO_CHAT_SESSION_SECRET?: string;
  PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT?: string;
  PORTFOLIO_CHAT_TURNSTILE_REQUIRED?: string;
  TURNSTILE_SECRET_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_PORTFOLIO_MODEL?: string;
  OPENAI_PORTFOLIO_REASONING_EFFORT?: string;
  PORTFOLIO_CHAT_RATE_LIMITER?: PortfolioChatRateLimiter;
  PORTFOLIO_CHAT_PREVIEW_RATE_LIMITER?: PortfolioChatRateLimiter;
  PORTFOLIO_CHAT_BUDGET?: PortfolioChatBudgetNamespace;
};

type RuntimeEvent = PortfolioChatLaunchEvent | PortfolioChatStreamEvent;

type PortfolioChatRuntimeOptions = {
  env: PortfolioChatRuntimeEnv;
  fetchImplementation?: typeof fetch;
  getProvider?: () => PortfolioChatProvider;
  now?: () => number;
  randomId?: () => string;
  record?: (event: RuntimeEvent) => void;
};

const reasoningEfforts = new Set([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

type ReasoningEffort =
  | "none"
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
    liveEnabled: env.PORTFOLIO_CHAT_LIVE_ENABLED === "true",
    previewEnabled: env.PORTFOLIO_CHAT_PREVIEW_ENABLED === "true",
    previewAccessCode: env.PORTFOLIO_CHAT_PREVIEW_ACCESS_CODE,
    sessionSecret: env.PORTFOLIO_CHAT_SESSION_SECRET,
    dailyRequestLimit: positiveInteger(env.PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT),
    turnstileRequired: env.PORTFOLIO_CHAT_TURNSTILE_REQUIRED === "true",
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
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

function configuredProvider(env: PortfolioChatRuntimeEnv) {
  const effort = env.OPENAI_PORTFOLIO_REASONING_EFFORT;
  return (
    Boolean(env.OPENAI_API_KEY) &&
    Boolean(env.OPENAI_PORTFOLIO_MODEL) &&
    Boolean(env.PORTFOLIO_CHAT_BUDGET) &&
    Boolean(positiveInteger(env.PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT)) &&
    (!effort || reasoningEfforts.has(effort))
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
}: PortfolioChatRuntimeOptions) {
  const config = runtimeConfig(env);
  const safeRecord = (event: RuntimeEvent) => {
    try {
      record(event);
    } catch {
      // Operational logging must not change the request outcome.
    }
  };
  const previewHandler = createPortfolioChatPreviewHandler({
    config,
    now,
    randomId,
    previewRateLimiter: env.PORTFOLIO_CHAT_PREVIEW_RATE_LIMITER,
  });
  const guard = createPortfolioChatLaunchGuard({
    config,
    rateLimiter: env.PORTFOLIO_CHAT_RATE_LIMITER,
    verifyTurnstile: createTurnstileVerifier(fetchImplementation),
    now,
    randomId,
    record: safeRecord,
  });

  return {
    handlePreview: previewHandler,
    async handleChat(request: Request) {
      if (!config.liveEnabled) {
        const result = await guard(request);
        if (!result.ok) return result.response;
      }
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

      const launch = await guard(request, {
        challengeToken: parsed.value.challengeToken,
      });
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
          return jsonResponse(503, {
            code: "budget_exhausted",
            message: "The answer service has reached its daily limit.",
          });
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
            fetchImplementation,
          }));
      const handler = createPortfolioChatHandler({
        isEnabled: () => true,
        getProvider: providerFactory,
        getRequestContext: () => ({
          requestId: launch.requestId,
          safetyIdentifier: launch.safetyIdentifier,
          providerModel: env.OPENAI_PORTFOLIO_MODEL!,
        }),
        now,
        record: safeRecord,
      });
      return handler(request, { ...parsed.value, grounding });
    },
  };
}
