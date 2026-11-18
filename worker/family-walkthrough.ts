// The public repository keeps the fingerprint, not the unlisted directory or its assets.
const PREFIX_DIGEST = "2902b0f5c48ac3aaccd38e6cf7ab39c99d96e5e6a854f90b02bad6b868eb9005";
const PRIVACY_HEADERS = {
  "x-robots-tag": "noindex, nofollow, noarchive",
  "referrer-policy": "no-referrer",
};
type AssetBinding = { fetch(request: Request): Promise<Response> };

export async function handleFamilyWalkthrough(
  request: Request,
  origin: AssetBinding | undefined,
  expectedDigest = PREFIX_DIGEST,
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = /^\/([0-9a-f]{32})(?=\/|$)/.exec(url.pathname);
  if (!match) return null;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(match[1]));
  const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  if (digest !== expectedDigest) return null;
  if (url.origin !== "https://bradleyberkman.com") return new Response(null, { status: 404, headers: PRIVACY_HEADERS });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...PRIVACY_HEADERS, allow: "GET, HEAD" } });
  }
  if (url.pathname === match[0]) {
    return new Response(null, { status: 308, headers: { ...PRIVACY_HEADERS, location: url.pathname + "/" } });
  }
  const asset = new URL("https://walkthrough.internal");
  asset.pathname = url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname;
  // The static build uses plain path components. Don't pass ambiguous escaping or empty segments.
  if (!/^\/(?:[\w.-]+\/)*[\w.-]+$/.test(asset.pathname)) return new Response(null, { status: 404, headers: PRIVACY_HEADERS });
  const headers = new Headers();
  for (const name of ["range", "if-range", "if-none-match", "if-modified-since"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (!origin) return new Response(null, { status: 503, headers: PRIVACY_HEADERS });
  try {
    const response = await origin.fetch(new Request(asset, { method: request.method, headers, redirect: "manual" }));
    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
      return new Response(null, { status: 502, headers: PRIVACY_HEADERS });
    }
    const publicHeaders = new Headers(PRIVACY_HEADERS);
    for (const name of ["content-type", "content-length", "content-encoding", "cache-control", "etag", "last-modified", "accept-ranges", "content-range"]) {
      const value = response.headers.get(name);
      if (value !== null) publicHeaders.set(name, value);
    }
    return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers: publicHeaders });
  } catch {
    // An upstream error must not send the private asset URL to the portfolio error page.
    return new Response(null, { status: 502, headers: PRIVACY_HEADERS });
  }
}
