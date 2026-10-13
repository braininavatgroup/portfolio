import { describe, expect, it } from 'vitest';
import { fetchPortfolioAssignments, resolveAssignmentToken, ASSIGNMENTS_URL, AssignmentConfigurationError } from './portfolio-insights-assignments.mjs';
const token = 'a'.repeat(64);
const row = { actionRecordId: 'uuid', campaignCode: 'random123', portfolioUrl: 'https://bradleyberkman.com/?campaign=random123', channel: 'Application', sentAt: null, action: 'Draft application', state: 'suggested', person: null, company: 'Example', job: null };
const answer = (assignments: unknown[]) => async () => Response.json({ version: 1, assignments });
describe('Supabase assignment reader', () => {
  it('reads only the fixed endpoint, without redirects or a Supabase key', async () => {
    const rows = await fetchPortfolioAssignments({ token, fetchImpl: async (url, init) => {
      expect(url).toBe(ASSIGNMENTS_URL);
      expect(init?.method).toBe('GET');
      expect(init?.redirect).toBe('error');
      expect(init?.headers).toEqual({ 'x-portfolio-assignments-token': token });
      expect(init?.body).toBeUndefined();
      return Response.json({ version: 1, assignments: [row] });
    } });
    expect(rows).toEqual([row]);
  });
  it('fails closed on duplicate or malformed assignments without echoing identities/codes', async () => {
    for (const rows of [[row, row], [{ ...row, portfolioUrl: 'https://wrong.example' }], [{ ...row, person: { name: 'Name', airtableUrl: 'https://airtable.com/private' } }]]) {
      const error = await fetchPortfolioAssignments({ token, fetchImpl: answer(rows) }).catch(e => e);
      expect(error).toBeInstanceOf(AssignmentConfigurationError);
      expect(error.message).not.toContain('random123');
      expect(error.message).not.toContain('Name');
    }
  });
  it('never logs upstream bodies or transport errors', async () => {
    for (const fetchImpl of [async () => new Response(token, { status: 403 }), async () => { throw new Error(token); }]) {
      const error = await fetchPortfolioAssignments({ token, fetchImpl }).catch(e => e);
      expect(error.message).not.toContain(token);
    }
  });
  it('does not fall back to old Airtable or general credentials', async () => {
    const reads: string[] = [];
    expect(await resolveAssignmentToken({ env: { PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN: 'old', JOB_SEARCH_SUPABASE_SERVICE_KEY: 'broad' }, readKeychain: async (service, account) => { reads.push(`${service}/${account}`); throw new Error('missing'); } })).toBeNull();
    expect(reads).toEqual(['biv-portfolio-insights/assignment-read-token']);
    expect(await resolveAssignmentToken({ env: { PORTFOLIO_ASSIGNMENTS_READ_TOKEN: token } })).toBe(token);
  });
});
