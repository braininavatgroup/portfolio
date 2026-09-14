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
 *
 * Everything else about the request has to survive the rebuild. `new Request()`
 * copies neither the redirect mode — the runtime hands in `manual`, and the
 * constructor default `follow` would swallow a redirect the visitor should
 * receive — nor the abort signal, nor the Cloudflare `cf` metadata.
 *
 * Nothing on this path reads `cf` today: the insight sink that does is POST
 * only, and a bodied method never reaches the rebuild. It is restored anyway
 * because vinext restores it on every request it reconstructs, and a repaired
 * request that is subtly unlike every other request in the Worker is a trap for
 * whoever next reads `cf` from a GET.
 */
export function withoutPhantomBody(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return request;
  if (!PHANTOM_BODY_HEADERS.some((header) => request.headers.has(header))) {
    return request;
  }
  const headers = new Headers(request.headers);
  for (const header of PHANTOM_BODY_HEADERS) headers.delete(header);
  const repaired = new Request(request.url, {
    method: request.method,
    headers,
    redirect: request.redirect,
    signal: request.signal,
  });
  const cf = (request as { cf?: unknown }).cf;
  if (cf !== undefined) {
    Object.defineProperty(repaired, "cf", {
      value: cf,
      enumerable: true,
      configurable: true,
    });
  }
  return repaired;
}
