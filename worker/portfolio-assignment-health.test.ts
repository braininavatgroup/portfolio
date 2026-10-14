import { describe, expect, it } from 'vitest';
import { ASSIGNMENT_HEALTH_PATH, handlePortfolioAssignmentHealth } from './portfolio-assignment-health';

const token = 'a'.repeat(64);
const url = `https://bradleyberkman.com${ASSIGNMENT_HEALTH_PATH}`;
const authorized = (method = 'GET') => new Request(url, { method, headers: { 'x-portfolio-assignments-token': token } });

describe('scheduled assignment reader health', () => {
  it('refuses unsigned and wrong-token reads before touching the binding', async () => {
    let calls = 0;
    const env = { PORTFOLIO_ASSIGNMENTS_READ_TOKEN: token, JOB_SEARCH_ASSIGNMENTS: { fetch: async () => { calls++; return new Response(); } } as unknown as Fetcher };
    expect((await handlePortfolioAssignmentHealth(new Request(url), env))?.status).toBe(403);
    expect((await handlePortfolioAssignmentHealth(new Request(url, { headers: { 'x-portfolio-assignments-token': 'b'.repeat(64) } }), env))?.status).toBe(403);
    expect((await handlePortfolioAssignmentHealth(authorized(), {}))?.status).toBe(403);
    expect(calls).toBe(0);
  });

  it('reads only the bound route and returns a count without identities or codes', async () => {
    const env = { PORTFOLIO_ASSIGNMENTS_READ_TOKEN: token, JOB_SEARCH_ASSIGNMENTS: { fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(input instanceof Request ? input.url : input).pathname).toBe('/internal/portfolio-assignments');
      expect(init?.headers).toEqual({ 'x-portfolio-assignments-token': token });
      return Response.json({ version: 1, assignments: [{ actionRecordId: 'private-action', campaignCode: 'opaque-code-1', portfolioUrl: 'https://bradleyberkman.com/?campaign=opaque-code-1', channel: 'Application', sentAt: null, action: 'private action', state: 'Suggested', person: null, company: 'private company', job: null }] });
    } } as unknown as Fetcher };
    const response = await handlePortfolioAssignmentHealth(authorized(), env);
    expect(response?.status).toBe(200);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(await response?.json()).toEqual({ version: 1, status: 'fresh', count: 1 });
    expect((await handlePortfolioAssignmentHealth(authorized('POST'), env))?.status).toBe(405);
    expect((await handlePortfolioAssignmentHealth(new Request(`${url}?raw=1`, { headers: { 'x-portfolio-assignments-token': token } }), env))?.status).toBe(400);
  });

  it('keeps failures private and distinguishes a response from a transport failure', async () => {
    const env = { PORTFOLIO_ASSIGNMENTS_READ_TOKEN: token, JOB_SEARCH_ASSIGNMENTS: { fetch: async () => new Response('private response', { status: 403 }) } as unknown as Fetcher };
    expect(await (await handlePortfolioAssignmentHealth(authorized(), env))?.json()).toEqual({ version: 1, status: 'unavailable', upstreamStatus: 403 });
    env.JOB_SEARCH_ASSIGNMENTS = { fetch: async () => { throw new Error('private error with code'); } } as unknown as Fetcher;
    expect(await (await handlePortfolioAssignmentHealth(authorized(), env))?.json()).toEqual({ version: 1, status: 'unavailable', upstreamStatus: null });
  });
});
