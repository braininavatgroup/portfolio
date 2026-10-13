import { portfolioActivity } from '../scripts/portfolio-insights-activity.mjs';
import { r2InsightStorage, INSIGHTS_PREFIX } from './portfolio-insights-store';
import content from '../content/portfolio-content.json';

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
  if (new URL(request.url).pathname !== ACTIVITY_PATH) return null;
  const answer = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  const secret = env.PORTFOLIO_ACTIVITY_READ_TOKEN;
  const supplied = request.headers.get('x-portfolio-activity-token') || '';
  if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret) || !/^[a-f0-9]{64}$/.test(supplied)) return answer({ error: 'Forbidden' }, 403);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const proof = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(secret));
  if (!(await crypto.subtle.verify('HMAC', key, proof, new TextEncoder().encode(supplied)))) return answer({ error: 'Forbidden' }, 403);
  if (request.method !== 'GET') return answer({ error: 'Method not allowed' }, 405);
  if (new URL(request.url).search) return answer({ error: 'Query parameters are not supported' }, 400);
  return answer(await readPortfolioActivity(env));
}
