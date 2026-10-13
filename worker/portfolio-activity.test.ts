import { describe, expect, it } from 'vitest';
import { handlePortfolioActivity, readPortfolioActivity } from './portfolio-activity';

const token = 'a'.repeat(64);
describe('dedicated activity read capability', () => {
  it('fails closed without its exact token, including a signed-out preview', async () => {
    const request = new Request('https://portfolio-activity.internal/internal/portfolio-activity');
    expect((await handlePortfolioActivity(request, {}))?.status).toBe(403);
    expect((await handlePortfolioActivity(request, { PORTFOLIO_ACTIVITY_READ_TOKEN: token }))?.status).toBe(403);
    const wrong = new Request(request, { headers: { 'x-portfolio-activity-token': 'b'.repeat(64) } });
    expect((await handlePortfolioActivity(wrong, { PORTFOLIO_ACTIVITY_READ_TOKEN: token }))?.status).toBe(403);
  });
  it('allows only the exact GET projection, no queries or writes', async () => {
    const env = { PORTFOLIO_ACTIVITY_READ_TOKEN: token };
    const headers = { 'x-portfolio-activity-token': token };
    for (const method of ['POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      expect((await handlePortfolioActivity(new Request('https://portfolio-activity.internal/internal/portfolio-activity', { method, headers }), env))?.status).toBe(405);
    }
    expect(await handlePortfolioActivity(new Request('https://portfolio-activity.internal/', { headers }), env)).toBeNull();
    expect((await handlePortfolioActivity(new Request('https://portfolio-activity.internal/internal/portfolio-activity?raw=true', { headers }), env))?.status).toBe(400);
    const response = await handlePortfolioActivity(new Request('https://portfolio-activity.internal/internal/portfolio-activity', { headers }), env);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(await response?.json()).toMatchObject({ status: 'unavailable', items: [] });
  });
  it('reads no shared transcript, identities, tokens or raw-event endpoint', async () => {
    const request = new Request('https://portfolio-activity.internal/internal/portfolio-activity', { headers: { 'x-portfolio-activity-token': token } });
    const keys: string[] = [];
    const now = new Date('2026-10-13T18:20:00Z');
    const capturedAt = '2026-10-13T18:00:00.000Z';
    const rawKey = 'runs/raw-events-2026-10-13T18-00-00-000Z.json';
    const object = (value: unknown) => ({ text: async () => JSON.stringify(value) });
    const bucket = { list: async () => ({ objects: [{ key: rawKey }], truncated: false }), get: async (key: string) => {
      keys.push(key);
      if (key === rawKey) return object({ capturedAt, windowStart: '2026-10-07T00:00:00Z', events: [{ schema: 'v2', sessionId: 'opaque-tab-1', action: 'contact_action', contactKind: 'cv', timestamp: capturedAt }] });
      if (key === 'runs/source-insights.json') return object({ capturedAt, value: {} });
      return null;
    } } as unknown as R2Bucket;
    const result = await readPortfolioActivity({ PORTFOLIO_INSIGHTS_STORE: bucket }, now);
    expect(result.status).toBe('fresh'); expect(result.items).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('opaque-tab-1'); expect(keys).toEqual([rawKey, 'runs/source-insights.json']);
    expect((await readPortfolioActivity({ PORTFOLIO_INSIGHTS_STORE: bucket }, new Date('2026-10-15T18:00:00Z'))).status).toBe('stale');
    expect((await handlePortfolioActivity(request, { PORTFOLIO_ACTIVITY_READ_TOKEN: token }))?.status).toBe(200);
  });

  it('never labels a failed or capped source as a complete fresh empty result', async () => {
    const capturedAt = new Date().toISOString();
    let source: unknown = null;
    const bucket = { list: async () => ({ objects: [{ key: 'runs/raw-events-' + capturedAt.replaceAll(':', '-').replace('.', '-') + '.json' }], truncated: false }),
      get: async (key: string) => ({ text: async () => JSON.stringify(key === 'runs/source-insights.json' ? { capturedAt, value: source } : { capturedAt, events: Array.from({ length: 101 }, (_, n) => ({ schema: 'v2', sessionId: 'tab-' + n, action: 'contact_action', contactKind: 'cv', timestamp: capturedAt })) }) }) } as unknown as R2Bucket;
    const failed = await readPortfolioActivity({ PORTFOLIO_INSIGHTS_STORE: bucket });
    expect(failed.status).toBe('stale'); expect(failed.truncated).toBe(true); expect(failed.items).toHaveLength(100);
    source = {};
    expect((await readPortfolioActivity({ PORTFOLIO_INSIGHTS_STORE: bucket })).status).toBe('fresh');
  });
});
