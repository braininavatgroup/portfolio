import { env, waitUntil } from "cloudflare:workers";
import {
  createPortfolioChatRuntime,
  type PortfolioChatRuntimeEnv,
} from "../../../lib/server/portfolio-chat-runtime";

export async function POST(request: Request) {
  return createPortfolioChatRuntime({
    env: env as unknown as PortfolioChatRuntimeEnv,
    waitUntil,
  }).handleChat(request);
}
