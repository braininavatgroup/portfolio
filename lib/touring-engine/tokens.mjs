// ============================================================================
// tokens.js — opaque per-show token mint/resolve + form field whitelist +
// submission sanitization + append-only read-latest merge.
//
// PURE core (no Google, no ambient time). `now` is injected; randomness is
// injected via a byte source `randBytes` (defaults to a CSPRNG —
// crypto.getRandomValues — NOT ambient *time*).
//
// Security model (SSoT-source §61, §231): the token is a confidentiality+write
// surface. It MUST be CSPRNG-generated (never guessable), opaque (server-mapped,
// never self-describing), fixed-width, rejected when unknown/expired/used, and
// submissions MUST be limited to the columns the form owns (field whitelist) and
// stored append-only / read-latest (no blind overwrite — partial submits
// accumulate).
// ============================================================================

import { FORM_TYPE, OWNER, TOKEN_TYPE, isEmpty } from './types.mjs';

// formType ('promoter'|'artist') -> the registry owner that form is allowed to write.
const OWNER_FOR_FORM_TOKENS = Object.freeze({
  [FORM_TYPE.PROMOTER]: OWNER.PROMOTER,
  [FORM_TYPE.ARTIST]: OWNER.ARTIST,
});

// Default CSPRNG byte source. Injected so tests are deterministic. Returns a
// Uint8Array of `n` cryptographically-strong random bytes — this is entropy, not
// wall-clock time, so it does not violate the "no ambient time" core rule.
// NOTE (Apps Script flatten guard): `crypto.getRandomValues` is referenced
// INSIDE this body, never at module top level — core/tokens.js flattens into
// build/Code.gs which parses under Apps Script V8 (no Web Crypto). No Apps
// Script path calls mintToken today, so the reference is never evaluated there;
// keeping it off the top level lets the flatten still load.
function defaultBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

/**
 * Mint an opaque per-show token mapped server-side to {showId,formType,expiry,used}.
 * The token string carries NO information about the show or form — it is a fixed
 * 36-char lowercase-hex string (18 CSPRNG bytes, 144 bits). Callers persist
 * `record` in the token store keyed by `token`.
 *
 * @param {string} showId
 * @param {'promoter'|'artist'} formType
 * @param {string} expiryISO              ISO timestamp after which the token is dead
 * @param {(n: number) => Uint8Array} [randBytes]  CSPRNG byte source (default crypto.getRandomValues)
 * @returns {{ token: string, record: { showId: string, formType: string, expiry: string, used: boolean } }}
 */
export function mintToken(showId, formType, expiryISO, randBytes = defaultBytes) {
  const bytes = randBytes(18);
  // Hex-encode each byte fixed-width (padStart guards leading-zero loss) → 36 chars.
  let token = '';
  for (let i = 0; i < bytes.length; i++) {
    token += bytes[i].toString(16).padStart(2, '0');
  }
  return {
    token,
    record: { showId, formType, expiry: expiryISO, used: false },
  };
}

/**
 * Resolve an opaque token against the server-side store. Rejects unknown,
 * expired, and already-used tokens.
 *
 * @param {string} token
 * @param {Object<string, {showId:string, formType:string, expiry:string, used:boolean}>} store
 * @param {string} nowISO   injected current time (ISO)
 * @returns {{ showId:string, formType:string } | { error:string }}
 */
export function resolveToken(token, store, nowISO) {
  const record = store && store[token];
  if (!record) return { error: 'unknown' };
  if (record.expiry && nowISO >= record.expiry) return { error: 'expired' };
  if (record.used) return { error: 'used' };
  return { showId: record.showId, formType: record.formType };
}

/**
 * Resolve an opaque ARTIST DASHBOARD token. Unlike a per-show form token, a
 * dashboard token authorizes an artist (all their shows), is REUSABLE (never
 * marked `used` — the artist returns repeatedly), and stores the artist name in
 * the record's `showId`/subject column. Rejects unknown, wrong-type (a per-show
 * token presented to the hub), and expired tokens.
 *
 * @param {string} token
 * @param {Object<string, {showId:string, formType:string, expiry:string, used:boolean}>} store
 * @param {string} nowISO   injected current time (ISO)
 * @returns {{ artist:string } | { error:string }}
 */
export function resolveDashboardToken(token, store, nowISO) {
  const record = store && store[token];
  if (!record) return { error: 'unknown' };
  if (record.formType !== TOKEN_TYPE.ARTIST_DASHBOARD) return { error: 'unknown' };
  if (record.expiry && nowISO >= record.expiry) return { error: 'expired' };
  // Deliberately NOT single-use: a dashboard token is reusable.
  return { artist: record.showId };
}

/**
 * The field_keys a given form is allowed to write — the security boundary for
 * sanitizeSubmission. Owner-based: promoter form owns PROMOTER fields, artist
 * form owns ARTIST fields. (Conditional/visibility filtering for *display* is
 * fieldsForForm's job; the whitelist is the full set the form may ever submit.)
 *
 * @param {import('./types.mjs').RegistryField[]} registry
 * @param {'promoter'|'artist'} formType
 * @returns {string[]}
 */
export function fieldWhitelist(registry, formType) {
  const owner = OWNER_FOR_FORM_TOKENS[formType];
  if (!owner) return [];
  return registry.filter((f) => f.owner === owner).map((f) => f.field_key);
}

/**
 * Drop any payload key not in the whitelist; report what was rejected. An
 * anonymous caller can POST arbitrary fields directly, so this is enforced
 * server-side on every submit.
 *
 * @param {Object<string,string>} payload
 * @param {string[]} whitelist
 * @returns {{ accepted: Object<string,string>, rejected: string[] }}
 */
export function sanitizeSubmission(payload, whitelist) {
  const allowed = new Set(whitelist);
  const accepted = {};
  const rejected = [];
  for (const key of Object.keys(payload || {})) {
    if (allowed.has(key)) accepted[key] = payload[key];
    else rejected.push(key);
  }
  return { accepted, rejected };
}

/**
 * Append-only / read-latest merge. Submission rows are never overwritten — each
 * submit appends a row {ts, token, fields}. Reading the current view replays
 * rows oldest→newest; a later non-empty value wins, but a blank/absent field
 * never clobbers an earlier value (so partial submits accumulate).
 *
 * @param {{ ts:string, token?:string, fields:Object<string,string> }[]} rows
 * @returns {Object<string,string>}  merged latest view
 */
export function latestSubmission(rows) {
  const sorted = [...(rows || [])].sort((a, b) => {
    if (a.ts < b.ts) return -1;
    if (a.ts > b.ts) return 1;
    return 0;
  });
  const merged = {};
  for (const row of sorted) {
    const fields = (row && row.fields) || {};
    for (const [k, v] of Object.entries(fields)) {
      if (!isEmpty(v)) merged[k] = v;
    }
  }
  return merged;
}
