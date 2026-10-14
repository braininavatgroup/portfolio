import { fetchBoundPortfolioAssignments } from './portfolio-assignment-binding';

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
  let transportError: unknown = null;
  try {
    const assignments = await fetchBoundPortfolioAssignments(env.JOB_SEARCH_ASSIGNMENTS, secret,
      status => { upstreamStatus = status; }, error => { transportError = error; });
    return answer({ version: 1, status: 'fresh', count: assignments.length });
  } catch {
    // The projection contains private identities and codes; expose only the
    // transport class, never the exception message or upstream response body.
    const message = transportError instanceof Error ? transportError.message.toLowerCase() : '';
    const transportCategory = message.includes('redirect') ? 'redirect'
      : message.includes('different request') ? 'request-context'
      : message.includes('subrequest') ? 'subrequest'
      : message.includes('service binding') ? 'service-binding'
      : message.includes('network') ? 'network'
      : message.includes('url') ? 'url'
      : 'other';
    return answer({ version: 1, status: 'unavailable', upstreamStatus, transportCategory }, 503);
  }
}
