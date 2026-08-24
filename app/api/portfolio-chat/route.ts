import { createOpenAIPortfolioProvider } from "../../../lib/server/openai-portfolio-provider";
import { createPortfolioChatHandler } from "../../../lib/server/portfolio-chat-handler";

function serverValue(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

const handlePortfolioChat = createPortfolioChatHandler({
  isEnabled: () => serverValue("PORTFOLIO_CHAT_LIVE_ENABLED") === "true",
  getProvider: () => {
    const apiKey = serverValue("OPENAI_API_KEY");
    const model = serverValue("OPENAI_PORTFOLIO_MODEL");
    if (!apiKey || !model) {
      throw new Error("Portfolio chat provider is not configured.");
    }
    return createOpenAIPortfolioProvider({ apiKey, model });
  },
});

export async function POST(request: Request) {
  return handlePortfolioChat(request);
}
