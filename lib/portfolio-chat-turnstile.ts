export type TurnstileWidgetId = string | number;

export type TurnstileCallbacks = {
  onToken(token: string): void;
  onError(): void;
  onExpired(): void;
};

export type TurnstileController = {
  reset(): void;
  remove(): void;
};

export type TurnstileRenderer = (
  container: HTMLElement,
  siteKey: string,
  callbacks: TurnstileCallbacks,
) => Promise<TurnstileController>;

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: "portfolio_chat";
      appearance: "interaction-only";
      size: "flexible";
      callback(token: string): void;
      "error-callback"(): void;
      "expired-callback"(): void;
    },
  ): TurnstileWidgetId;
  reset(widgetId: TurnstileWidgetId): void;
  remove(widgetId: TurnstileWidgetId): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const turnstileScriptId = "portfolio-chat-turnstile-script";
const turnstileScriptUrl =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoad: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Turnstile requires a browser."));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptLoad) return scriptLoad;

  scriptLoad = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(turnstileScriptId);
    const script = existing instanceof HTMLScriptElement ? existing : document.createElement("script");
    const finish = () => {
      if (window.turnstile) resolve(window.turnstile);
      else {
        script.remove();
        reject(new Error("Turnstile loaded without an API."));
      }
    };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => {
        script.remove();
        reject(new Error("Turnstile could not load."));
      },
      { once: true },
    );
    if (!existing) {
      script.id = turnstileScriptId;
      script.async = true;
      script.defer = true;
      script.src = turnstileScriptUrl;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    scriptLoad = null;
    throw error;
  });

  return scriptLoad;
}

export const renderTurnstile: TurnstileRenderer = async (
  container,
  siteKey,
  callbacks,
) => {
  const api = await loadTurnstile();
  // loadTurnstile resolves after the async script's load event. ready() is
  // incompatible with async/defer scripts, even when their API already exists.
  const widgetId = api.render(container, {
    sitekey: siteKey,
    action: "portfolio_chat",
    appearance: "interaction-only",
    size: "flexible",
    callback: callbacks.onToken,
    "error-callback": callbacks.onError,
    "expired-callback": callbacks.onExpired,
  });

  return {
    reset: () => api.reset(widgetId),
    remove: () => api.remove(widgetId),
  };
};
