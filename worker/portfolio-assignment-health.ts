import { handleInternalRead, internalJson } from './internal-read';
import { fetchBoundPortfolioAssignments } from './portfolio-assignment-binding';
import { AssignmentConfigurationError, AssignmentResponseError } from '../scripts/portfolio-insights-assignments.mjs';

type AssignmentHealthEnv = {
  JOB_SEARCH_ASSIGNMENTS?: Fetcher;
  PORTFOLIO_ASSIGNMENTS_READ_TOKEN?: string;
};

export const ASSIGNMENT_HEALTH_PATH = '/internal/portfolio-assignment-health';

export async function handlePortfolioAssignmentHealth(request: Request, env: AssignmentHealthEnv) {
  const gate = { path: ASSIGNMENT_HEALTH_PATH, header: 'x-portfolio-assignments-token', secret: env.PORTFOLIO_ASSIGNMENTS_READ_TOKEN };
  return handleInternalRead(request, gate, async (secret) => {
    if (!env.JOB_SEARCH_ASSIGNMENTS) return internalJson({ version: 1, status: 'unavailable', reason: 'binding' }, 503);

    let upstreamStatus: number | null = null;
    let transportError: unknown = null;
    try {
      const assignments = await fetchBoundPortfolioAssignments(env.JOB_SEARCH_ASSIGNMENTS, secret,
        status => { upstreamStatus = status; }, error => { transportError = error; });
      return internalJson({ version: 1, status: 'fresh', count: assignments.length });
    } catch (error) {
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
      const observation = error instanceof AssignmentConfigurationError || error instanceof AssignmentResponseError ? 'wrong' : 'unavailable';
      return internalJson({ version: 1, status: 'unavailable', upstreamStatus, transportCategory, observation }, 503);
    }
  });
}
