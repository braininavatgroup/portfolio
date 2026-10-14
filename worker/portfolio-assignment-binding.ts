import { fetchPortfolioAssignments } from '../scripts/portfolio-insights-assignments.mjs';

export async function fetchBoundPortfolioAssignments(binding: Fetcher, token: string, onStatus?: (status: number) => void, onTransportError?: (error: unknown) => void) {
  return fetchPortfolioAssignments({
    token,
    // A service binding accepts a Request. Constructing it here also keeps the
    // fixed URL, GET method and token header together. A redirect is returned
    // for inspection and rejected by the adapter; it is never followed.
    fetchImpl: async (input, init) => {
      let response: Response;
      try {
        response = await binding.fetch(new Request(input, { ...init, redirect: 'manual' }));
      } catch (error) {
        onTransportError?.(error);
        throw error;
      }
      onStatus?.(response.status);
      return response;
    },
  });
}
