// A GET or HEAD request that claims to carry a body.
//
// `Content-Length: 0` on a bodyless GET or HEAD is legal on the wire, and link
// checkers, email link scanners, and forward proxies send it routinely. Inside
// the Worker it is a contradiction: the method forbids a body, the header
// asserts one, and the request handler throws rather than choosing. The
// exception escapes the Worker and Cloudflare serves its own 1101 error page,
// so every app route answered 500 for these clients while the static assets
// beside them answered normally.
//
// Dropping the claim at the entry point means nothing downstream has to know
// about it.

/** Headers that assert a body a GET or HEAD request cannot actually carry. */
const PHANTOM_BODY_HEADERS = ["content-length", "transfer-encoding"];

/**
 * `request` with any phantom body declaration removed. Bodied methods keep
 * their headers untouched, because there the declaration is true.
 */
export function withoutPhantomBody(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return request;
  if (!PHANTOM_BODY_HEADERS.some((header) => request.headers.has(header))) {
    return request;
  }
  const headers = new Headers(request.headers);
  for (const header of PHANTOM_BODY_HEADERS) headers.delete(header);
  return new Request(request.url, { method: request.method, headers });
}
