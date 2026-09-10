import { env } from "cloudflare:workers";
import {
  createPortfolioChatRuntime,
  type PortfolioChatRuntimeEnv,
} from "../../../../lib/server/portfolio-chat-runtime";

export async function GET(request: Request) {
  return createPortfolioChatRuntime({
    env: env as unknown as PortfolioChatRuntimeEnv,
  }).handleSession(request);
}
