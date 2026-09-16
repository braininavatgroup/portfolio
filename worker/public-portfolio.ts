// What the public portfolio exposes to search engines and to Clarity.
//
// The portfolio pages are public: they carry no crawler exclusion, and eligible
// documents on the public hostnames carry the `external` marker that lets
// Clarity start.
//
// Supporting routes keep their exclusion. They are Bradley's working surfaces,
// not portfolio pages, so they stay out of search results and out of the
// visitor dataset.

export const PUBLIC_PORTFOLIO_HOSTS = new Set([
  "bradleyberkman.com",
  "www.bradleyberkman.com",
]);

const ROBOTS_EXCLUSION = "noindex, nofollow, noarchive";

/** Supporting surfaces, excluded deliberately and permanently. */
const SUPPORTING_ROUTES = new Set([
  "/design",
]);

// `/_portfolio-preview/` served the retired password gate (PER-16). It stays
// listed because historical analytics rows still carry those paths, and a
// prefix that matches nothing costs nothing.
const SUPPORTING_PREFIXES = ["/_portfolio-feedback/", "/_portfolio-preview/"];

export function isSupportingRoute(pathname: string) {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return (
    SUPPORTING_ROUTES.has(normalized) ||
    SUPPORTING_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

function isHtml(response: Response) {
  return Boolean(
    response.headers.get("content-type")?.toLowerCase().includes("text/html"),
  );
}

/** Marks the root element so the client knows which visit context it is in. */
export function setAnalyticsContext(response: Response, context: string) {
  if (!isHtml(response)) return response;
  return new HTMLRewriter()
    .on("html", {
      element(element) {
        element.setAttribute("data-portfolio-analytics-context", context);
      },
    })
    .transform(response);
}

export function excludeFromSearch(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", ROBOTS_EXCLUSION);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// No env parameter: what this layer decided from the environment was whether the
// password gate owned the crawler markers. The gate is gone (PER-16), so the
// decision is now purely about the hostname.
export async function withPublicPortfolio(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  const response = await next();

  if (isSupportingRoute(url.pathname)) {
    return excludeFromSearch(response);
  }

  // Local development and workers.dev previews are never the public portfolio.
  if (!PUBLIC_PORTFOLIO_HOSTS.has(url.hostname.toLowerCase())) {
    return response;
  }

  return setAnalyticsContext(response, "external");
}
