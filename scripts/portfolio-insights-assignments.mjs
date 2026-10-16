// The job-board Worker owns this narrow, read-only Supabase projection.
// No Supabase service key or legacy Airtable fallback belongs in this client.
export const ASSIGNMENTS_URL = 'https://bradley-job-board.bradley-d45.workers.dev/internal/portfolio-assignments';
export const ASSIGNMENTS_TOKEN_ENV = 'PORTFOLIO_ASSIGNMENTS_READ_TOKEN';
export class AssignmentConfigurationError extends Error {
  constructor(/** @type {string[]} */ problems) {
    super(problems.join('; '));
    this.name = 'AssignmentConfigurationError';
    this.problems = problems;
  }
}
export class AssignmentRequestError extends Error {
  constructor(/** @type {string} */ message) { super(message); this.name = 'AssignmentRequestError'; }
}
export class AssignmentResponseError extends AssignmentRequestError {}

/** @param {{env?: Record<string, string | undefined>, readKeychain?: (service: string, account: string) => Promise<string>}} options */
export async function resolveAssignmentToken({ env = {}, readKeychain } = {}) {
  if (env[ASSIGNMENTS_TOKEN_ENV]?.trim()) return env[ASSIGNMENTS_TOKEN_ENV].trim();
  try { return (await readKeychain?.('biv-portfolio-insights', 'assignment-read-token'))?.trim() || null; }
  catch { return null; }
}

/** @param {{token: string, fetchImpl?: typeof fetch, accessHeaders?: Record<string, string>}} options */
export async function fetchPortfolioAssignments({ token, fetchImpl = globalThis.fetch, accessHeaders = {} }) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new AssignmentRequestError('A dedicated assignment-read token is required');
  let response;
  try {
    response = await fetchImpl(ASSIGNMENTS_URL, { method: 'GET', redirect: 'error', headers: { ...accessHeaders, 'x-portfolio-assignments-token': token } });
  } catch { throw new AssignmentRequestError('Assignment request failed'); }
  if (!response.ok) {
    const Failure = [401, 403].includes(response.status) ? AssignmentRequestError : AssignmentResponseError;
    throw new Failure(`Assignment request failed: HTTP ${response.status}`);
  }
  let body;
  try { body = await response.json(); }
  catch (error) {
    if (error instanceof SyntaxError) throw new AssignmentResponseError('Assignment response is not JSON');
    throw new AssignmentRequestError('Assignment response could not be read');
  }
  if (body?.version !== 1 || !Array.isArray(body.assignments)) throw new AssignmentConfigurationError(['Unsupported assignment projection']);
  const codes = new Set();
  for (const row of body.assignments) {
    if (!row || typeof row.actionRecordId !== 'string' || typeof row.campaignCode !== 'string' || !/^[a-z0-9][a-z0-9_-]{5,63}$/.test(row.campaignCode)
      || row.portfolioUrl !== `https://bradleyberkman.com/?campaign=${row.campaignCode}`
      || !['Email', 'LinkedIn', 'Application', 'Referral', 'Other'].includes(row.channel)
      || (row.sentAt !== null && (typeof row.sentAt !== 'string' || !Number.isFinite(Date.parse(row.sentAt))))
      || typeof row.action !== 'string' || typeof row.state !== 'string'
      || (row.person !== null && (typeof row.person?.name !== 'string' || row.person.airtableUrl !== ''))
      || (row.company !== null && typeof row.company !== 'string')
      || (row.job !== null && (typeof row.job?.title !== 'string' || typeof row.job.stage !== 'string' || (row.job.outcome !== null && typeof row.job.outcome !== 'string')))) {
      throw new AssignmentConfigurationError(['Malformed assignment projection']);
    }
    if (codes.has(row.campaignCode)) throw new AssignmentConfigurationError(['Duplicate campaign code; attribution refused']);
    codes.add(row.campaignCode);
  }
  return body.assignments;
}
