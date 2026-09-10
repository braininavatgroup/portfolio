export type PortfolioChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const maxPortfolioChatConversationMessages = 6;
export const maxPortfolioChatConversationCharacters = 6_000;
const maxPortfolioChatMessageCharacters = 1_600;

function isPortfolioChatMessage(value: unknown): value is PortfolioChatMessage {
  if (!value || typeof value !== "object") return false;
  const role = Reflect.get(value, "role");
  const content = Reflect.get(value, "content");
  return (
    (role === "user" || role === "assistant") &&
    typeof content === "string" &&
    Boolean(content.trim())
  );
}

export function boundPortfolioChatConversation(
  messages: readonly PortfolioChatMessage[],
): PortfolioChatMessage[] {
  const bounded = messages
    .slice(-maxPortfolioChatConversationMessages)
    .map(({ role, content }) => ({
      role,
      content: content.trim().slice(0, maxPortfolioChatMessageCharacters),
    }))
    .filter(({ content }) => Boolean(content));

  let characters = bounded.reduce((total, message) => total + message.content.length, 0);
  while (characters > maxPortfolioChatConversationCharacters && bounded.length > 0) {
    const removed = bounded.shift();
    characters -= removed?.content.length ?? 0;
  }
  return bounded;
}

export function appendPortfolioChatTurn(
  messages: readonly PortfolioChatMessage[],
  question: string,
  answer: string,
) {
  return boundPortfolioChatConversation([
    ...messages,
    { role: "user", content: question },
    { role: "assistant", content: answer },
  ]);
}

export function parsePortfolioChatConversation(value: unknown):
  | { ok: true; value: PortfolioChatMessage[] }
  | { ok: false } {
  if (!Array.isArray(value)) return { ok: false };
  if (value.length > maxPortfolioChatConversationMessages) return { ok: false };
  if (!value.every(isPortfolioChatMessage)) return { ok: false };
  return {
    ok: true,
    value: boundPortfolioChatConversation(value),
  };
}
