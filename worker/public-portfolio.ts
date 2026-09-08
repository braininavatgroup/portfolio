// What the public portfolio exposes to search engines and to Clarity.
//
// While `PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED` is `true`, the password
// gate marks every response `noindex` and every document `preview`, so this
// layer has nothing to add. Once the gate is off, the portfolio pages are
// public: they carry no crawler exclusion, and eligible documents on the
// public hostnames carry the `external` marker that lets Clarity start.
//
// Supporting routes keep their exclusion in both modes. They are Bradley's
// working surfaces, not portfolio pages, so they stay out of search results
// and out of the visitor dataset whether or not a password gate is in front
// of them.

export interface PublicPortfolioEnv {
  PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED?: string;
}

export const PUBLIC_PORTFOLIO_HOSTS = new Set([
  "bradleyberkman.com",
  "www.bradleyberkman.com",
]);

const ROBOTS_EXCLUSION = "noindex, nofollow, noarchive";

/** Supporting surfaces, excluded deliberately and permanently. */
const SUPPORTING_ROUTES = new Set([
  "/copy-deck",
  "/copy-deck.zip",
  "/design",
]);

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

export async function withPublicPortfolio(
  request: Request,
  env: PublicPortfolioEnv,
  next: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  const response = await next();

  if (isSupportingRoute(url.pathname)) {
    return excludeFromSearch(response);
  }

  // The password gate owns both markers while it is on, and local development
  // and workers.dev previews are never the public portfolio.
  if (
    env.PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED === "true" ||
    !PUBLIC_PORTFOLIO_HOSTS.has(url.hostname.toLowerCase())
  ) {
    return response;
  }

  return setAnalyticsContext(response, "external");
}
