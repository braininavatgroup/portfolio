import { env } from "cloudflare:workers";
import {
  createPortfolioInsightSink,
  type PortfolioInsightSinkEnv,
} from "../../../lib/server/portfolio-insight-sink";

export async function POST(request: Request) {
  return createPortfolioInsightSink({
    env: env as unknown as PortfolioInsightSinkEnv,
  }).handle(request);
}
