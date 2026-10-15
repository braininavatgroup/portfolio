// The gate every token-protected internal read route shares: an exact path, a
// 64-hex secret compared in constant time, GET only, no query, and an uncached
// JSON answer. Credentials are checked before the method so an unsigned caller
// learns nothing about the route.

type InternalRead = { path: string; header: string; secret: string | undefined };

export function internalJson(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function handleInternalRead(request: Request, { path, header, secret }: InternalRead, read: (secret: string) => Promise<Response>) {
  const url = new URL(request.url);
  if (url.pathname !== path) return null;
  const supplied = request.headers.get(header) || '';
  if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret) || !/^[a-f0-9]{64}$/.test(supplied)) return internalJson({ error: 'Forbidden' }, 403);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const proof = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(secret));
  if (!(await crypto.subtle.verify('HMAC', key, proof, new TextEncoder().encode(supplied)))) return internalJson({ error: 'Forbidden' }, 403);
  if (request.method !== 'GET') return internalJson({ error: 'Method not allowed' }, 405);
  if (url.search) return internalJson({ error: 'Query parameters are not supported' }, 400);
  return read(secret);
}
