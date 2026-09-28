// Supporting routes are Bradley's working surfaces, not portfolio pages: the
// Worker keeps them out of search and the visitor dataset, and the sitemap
// leaves them out. Both read this one list.

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
