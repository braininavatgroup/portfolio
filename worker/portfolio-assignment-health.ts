import { fetchPortfolioAssignments } from '../scripts/portfolio-insights-assignments.mjs';

type AssignmentHealthEnv = {
  JOB_SEARCH_ASSIGNMENTS?: Fetcher;
  PORTFOLIO_ASSIGNMENTS_READ_TOKEN?: string;
};

export const ASSIGNMENT_HEALTH_PATH = '/internal/portfolio-assignment-health';

export async function handlePortfolioAssignmentHealth(request: Request, env: AssignmentHealthEnv) {
  if (new URL(request.url).pathname !== ASSIGNMENT_HEALTH_PATH) return null;
  const answer = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  const secret = env.PORTFOLIO_ASSIGNMENTS_READ_TOKEN;
  const supplied = request.headers.get('x-portfolio-assignments-token') || '';
  if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret) || !/^[a-f0-9]{64}$/.test(supplied)) return answer({ error: 'Forbidden' }, 403);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const proof = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(secret));
  if (!(await crypto.subtle.verify('HMAC', key, proof, new TextEncoder().encode(supplied)))) return answer({ error: 'Forbidden' }, 403);
  if (request.method !== 'GET') return answer({ error: 'Method not allowed' }, 405);
  if (new URL(request.url).search) return answer({ error: 'Query parameters are not supported' }, 400);
  if (!env.JOB_SEARCH_ASSIGNMENTS) return answer({ version: 1, status: 'unavailable', reason: 'binding' }, 503);

  let upstreamStatus: number | null = null;
  try {
    const assignments = await fetchPortfolioAssignments({
      token: secret,
      fetchImpl: async (input, init) => {
        const response = await env.JOB_SEARCH_ASSIGNMENTS!.fetch(input, init);
        upstreamStatus = response.status;
        return response;
      },
    });
    return answer({ version: 1, status: 'fresh', count: assignments.length });
  } catch {
    // The projection contains private identities and codes; expose only the
    // transport status to distinguish a refused read from a binding failure.
    return answer({ version: 1, status: 'unavailable', upstreamStatus }, 503);
  }
}
