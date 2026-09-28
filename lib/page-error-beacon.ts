// The page's own script errors go straight to the shared error intake
// (biv-errors, MUS-85), which turns each distinct error into one Linear issue.
// The browser posts to the intake's /beacon directly: that route is gated by
// the page's Origin and needs no secret, so the portfolio Worker carries none.
// Only the error and the path are sent: no query, no hash, no visitor id.

export const ERROR_INTAKE_BEACON_URL = "https://biv-errors.bradley-d45.workers.dev/beacon";

// The intake accepts beacons only from the origins in its BEACON_ORIGINS; the
// Worker's other hostname (insights.braininavat.dance) and local dev are not
// among them, so they send nothing rather than a refused request.
export const PAGE_ERROR_ORIGINS = ["https://bradleyberkman.com", "https://www.bradleyberkman.com"];

const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

type PageLocation = Pick<Location, "origin" | "pathname">;

export type PageErrorBeaconOptions = {
  location: PageLocation;
  send: (url: string, body: Blob) => boolean;
};

export type PageErrorBeacon = {
  report: (error: unknown, filename?: string) => boolean;
  install: (target: Pick<Window, "addEventListener" | "removeEventListener">) => () => void;
};

function withoutQuery(text: string) {
  return text.replace(/[?#][^\s):]*/g, "");
}

function primitiveText(value: unknown) {
  return ["string", "number", "boolean", "bigint", "symbol"].includes(typeof value)
    ? String(value as string)
    : "";
}

function describe(error: unknown) {
  if (error && typeof error === "object") {
    const { name, message, stack } = error as { name?: unknown; message?: unknown; stack?: unknown };
    return {
      name: typeof name === "string" && name ? name : "Error",
      message: primitiveText(message),
      stack: typeof stack === "string" ? stack : "",
    };
  }
  return { name: "Error", message: primitiveText(error), stack: "" };
}

export function createPageErrorBeacon({ location, send }: PageErrorBeaconOptions): PageErrorBeacon {
  const seen = new Set<string>();

  function report(error: unknown, filename?: string) {
    try {
      if (!PAGE_ERROR_ORIGINS.includes(location.origin)) return false;
      const { name, message, stack } = describe(error);
      if (!message || /^script error\.?$/i.test(message.trim())) return false;
      const key = `${name}\n${message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const body: Record<string, string> = {
        name: name.slice(0, 60),
        message: message.slice(0, MAX_MESSAGE),
        stack: withoutQuery(stack).slice(0, MAX_STACK),
        page: location.pathname,
      };
      if (filename) body.filename = withoutQuery(filename);
      return send(ERROR_INTAKE_BEACON_URL, new Blob([JSON.stringify(body)], { type: "text/plain" }));
    } catch {
      // Reporting an error must never cause another one.
      return false;
    }
  }

  function install(target: Pick<Window, "addEventListener" | "removeEventListener">) {
    const onError = (event: ErrorEvent) => {
      report(event.error ?? { name: "Error", message: event.message }, event.filename);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report(
        reason && typeof reason === "object"
          ? reason
          : { name: "UnhandledRejection", message: primitiveText(reason) },
      );
    };
    target.addEventListener("error", onError);
    target.addEventListener("unhandledrejection", onRejection);
    return () => {
      target.removeEventListener("error", onError);
      target.removeEventListener("unhandledrejection", onRejection);
    };
  }

  return { report, install };
}

let pageBeacon: PageErrorBeacon | undefined;

function browserBeacon() {
  if (typeof window === "undefined") return undefined;
  pageBeacon ??= createPageErrorBeacon({
    location: window.location,
    send: (url, body) => typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, body),
  });
  return pageBeacon;
}

/** Report an error caught by a React error boundary; boundaries never reach window.onerror. */
export function reportPageError(error: unknown) {
  return browserBeacon()?.report(error) ?? false;
}

/** Listen for uncaught errors and rejections on this page; returns the remover. */
export function installPageErrorBeacon() {
  return browserBeacon()?.install(window) ?? (() => {});
}
