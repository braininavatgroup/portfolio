import { describe, expect, it, vi } from 'vitest';
vi.mock('../scripts/portfolio-insights-core.mjs', () => ({ runInsights: async (_options: unknown, deps: { fetchers: { airtable: (token: string) => Promise<unknown> } }) => deps.fetchers.airtable('a'.repeat(64)) }));
import { runScheduledInsights } from './portfolio-insights-job';

describe('scheduled assignment capability', () => {
  it('uses only the service binding and exact read route', async () => {
    let calls = 0;
    const binding = { fetch: async (request: Request) => {
      calls++;
      expect(request).toBeInstanceOf(Request);
      expect(new URL(request.url).pathname).toBe('/internal/portfolio-assignments');
      expect(request.method).toBe('GET');
      expect(request.redirect).toBe('manual');
      expect(request.headers.get('x-portfolio-assignments-token')).toBe('a'.repeat(64));
      return Response.json({ version: 1, assignments: [] });
    } } as unknown as Fetcher;
    const result = await runScheduledInsights({ PORTFOLIO_INSIGHTS_STORE: {} as R2Bucket, JOB_SEARCH_ASSIGNMENTS: binding });
    expect(result).toEqual([]);
    expect(calls).toBe(1);
  });
  it('cannot fall back to a public fetch when a preview has no binding', async () => {
    await expect(runScheduledInsights({ PORTFOLIO_INSIGHTS_STORE: {} as R2Bucket })).rejects.toThrow('Assignment service binding is not configured');
  });
  it('refuses a bound redirect without following it', async () => {
    const binding = { fetch: async (request: Request) => {
      expect(request.redirect).toBe('manual');
      return new Response(null, { status: 302, headers: { location: 'https://elsewhere.example/' } });
    } } as unknown as Fetcher;
    await expect(runScheduledInsights({ PORTFOLIO_INSIGHTS_STORE: {} as R2Bucket, JOB_SEARCH_ASSIGNMENTS: binding }))
      .rejects.toThrow('Assignment request failed: HTTP 302');
  });
});
