import { portfolioActivity } from '../scripts/portfolio-insights-activity.mjs';
import { r2InsightStorage, INSIGHTS_PREFIX } from './portfolio-insights-store';
import content from '../content/portfolio-content.json';
import { handleInternalRead, internalJson } from './internal-read';

type ActivityEnv = { PORTFOLIO_INSIGHTS_STORE?: R2Bucket; PORTFOLIO_ACTIVITY_READ_TOKEN?: string };

export async function readPortfolioActivity(env: ActivityEnv, now = new Date()) {
  if (!env.PORTFOLIO_INSIGHTS_STORE) {
    return { version: 1, status: 'unavailable', capturedAt: null, truncated: false, items: [] };
  }
  try {
    const storage = r2InsightStorage(env.PORTFOLIO_INSIGHTS_STORE);
    const raw = await storage.readLatestRawEvents(INSIGHTS_PREFIX, now);
    const source = await storage.readSourceSnapshot(INSIGHTS_PREFIX, 'insights');
    if (!raw) return { version: 1, status: 'unavailable', capturedAt: null, truncated: false, items: [] };
    const age = now.getTime() - Date.parse(raw.capturedAt);
    const current = source?.value !== null && typeof source?.value === 'object' && !source.configurationErrors?.length && source.capturedAt === raw.capturedAt && age >= 0 && age < 26 * 3600000;
    const items = await portfolioActivity(raw.events, content);
    return { version: 1, status: current ? 'fresh' : 'stale', capturedAt: raw.capturedAt,
      truncated: Boolean(raw.truncated) || items.length > 100, items: items.slice(0, 100) };
  } catch {
    return { version: 1, status: 'unavailable', capturedAt: null, truncated: false, items: [] };
  }
}

export const ACTIVITY_PATH = '/internal/portfolio-activity';
export async function handlePortfolioActivity(request: Request, env: ActivityEnv) {
  return handleInternalRead(request, { path: ACTIVITY_PATH, header: 'x-portfolio-activity-token', secret: env.PORTFOLIO_ACTIVITY_READ_TOKEN },
    async () => internalJson(await readPortfolioActivity(env)));
}
