import { fetchPortfolioAssignments } from '../scripts/portfolio-insights-assignments.mjs';

export async function fetchBoundPortfolioAssignments(binding: Fetcher, token: string, onStatus?: (status: number) => void) {
  return fetchPortfolioAssignments({
    token,
    // A service binding accepts a Request. Constructing it here also keeps the
    // fixed URL, GET method, redirect policy and token header together.
    fetchImpl: async (input, init) => {
      const response = await binding.fetch(new Request(input, init));
      onStatus?.(response.status);
      return response;
    },
  });
}
