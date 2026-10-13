import { describe, expect, it, vi } from 'vitest';
vi.mock('../scripts/portfolio-insights-core.mjs', () => ({ runInsights: async (_options: unknown, deps: { fetchers: { airtable: (token: string) => Promise<unknown> } }) => deps.fetchers.airtable('a'.repeat(64)) }));
import { runScheduledInsights } from './portfolio-insights-job';

describe('scheduled assignment capability', () => {
  it('uses only the service binding and exact read route', async () => {
    let calls = 0;
    const binding = { fetch: async (url: string, init: RequestInit) => {
      calls++;
      expect(new URL(url).pathname).toBe('/internal/portfolio-assignments');
      expect(init.method).toBe('GET');
      expect(init.headers).toEqual({ 'x-portfolio-assignments-token': 'a'.repeat(64) });
      return Response.json({ version: 1, assignments: [] });
    } } as unknown as Fetcher;
    const result = await runScheduledInsights({ PORTFOLIO_INSIGHTS_STORE: {} as R2Bucket, JOB_SEARCH_ASSIGNMENTS: binding });
    expect(result).toEqual([]);
    expect(calls).toBe(1);
  });
  it('cannot fall back to a public fetch when a preview has no binding', async () => {
    await expect(runScheduledInsights({ PORTFOLIO_INSIGHTS_STORE: {} as R2Bucket })).rejects.toThrow('Assignment service binding is not configured');
  });
});
