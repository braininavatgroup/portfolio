type ClarityQueue = ((...arguments_: unknown[]) => void) & {
  q?: unknown[][];
};

declare global {
  interface Window {
    clarity?: ClarityQueue;
  }
}

const PUBLIC_PORTFOLIO_HOSTS = new Set([
  "bradleyberkman.com",
  "www.bradleyberkman.com",
]);

export const PUBLIC_CLARITY_PROJECT_ID = "yatoiqtrjm";

export function startPrivacySafeReplay({
  hostname,
  projectId,
}: {
  hostname: string;
  projectId?: string;
}) {
  const normalizedProjectId = projectId?.trim();
  if (
    !PUBLIC_PORTFOLIO_HOSTS.has(hostname.toLowerCase()) ||
    !normalizedProjectId ||
    !/^[a-z0-9]+$/i.test(normalizedProjectId)
  ) {
    return false;
  }

  if (!window.clarity) {
    const clarity: ClarityQueue = (...arguments_) => {
      clarity.q ??= [];
      clarity.q.push(arguments_);
    };
    clarity.q = [];
    window.clarity = clarity;
  }

  if (!document.querySelector("script[data-portfolio-replay]")) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.portfolioReplay = "";
    script.src = `https://www.clarity.ms/tag/${normalizedProjectId}`;
    document.head.appendChild(script);
  }

  return true;
}

export function setPrivacySafeReplayConsent(
  analyticsStorage: "granted" | "denied",
) {
  if (!window.clarity) return false;
  window.clarity("consentv2", {
    ad_Storage: "denied",
    analytics_Storage: analyticsStorage,
  });
  return true;
}
