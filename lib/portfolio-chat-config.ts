export function normalizePortfolioChatTurnstileSiteKey(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function getPortfolioChatTurnstileSiteKey() {
  return normalizePortfolioChatTurnstileSiteKey(
    import.meta.env.VITE_PORTFOLIO_CHAT_TURNSTILE_SITE_KEY,
  );
}
