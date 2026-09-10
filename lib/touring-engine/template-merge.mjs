// Template merge — pure {{token}} substitution + chase/travel token builders.
// Substitution uses a FUNCTION replacer so `$` sequences in values ($1, $&, $$)
// are inserted literally and never interpreted as replacement patterns.
import { isEmpty } from './types.mjs';

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Replace every {{key}} in `template` with tokens[key].
 * Missing/undefined key -> '' (empty string). Non-string values are stringified.
 * @param {string} template
 * @param {Object<string,string>} tokens
 * @returns {string}
 */
export function merge(template, tokens) {
  if (typeof template !== 'string') return '';
  const map = tokens || {};
  // Function replacer: the returned string is inserted verbatim, so a value like
  // 'Cost is $5 ($$ owed) — see $1' lands literally (no String.replace $-magic).
  return template.replace(TOKEN_RE, (_match, key) => {
    if (!Object.prototype.hasOwnProperty.call(map, key)) return '';
    const v = map[key];
    if (v === undefined || v === null) return '';
    return typeof v === 'string' ? v : String(v);
  });
}

/**
 * Whole-day difference (show_date − today), using UTC-noon arithmetic so there is
 * no timezone/DST drift. Both args are date-only 'YYYY-MM-DD'.
 * @returns {number|null} integer days, or null if either date is unparseable.
 */
function daysBetween(fromIso, toIso) {
  const parse = (iso) => {
    if (typeof iso !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  };
  const a = parse(fromIso);
  const b = parse(toIso);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * Tokens for the chase template:
 * {{artist}} {{venue}} {{show_date}} {{contact_name}} {{outstanding_items}} {{days_to_show}}
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').RegistryField[]} outstanding
 * @param {string} today 'YYYY-MM-DD'
 * @returns {Object<string,string>}
 */
export function buildChaseTokens(show, outstanding, today) {
  const s = show || {};
  const items = (outstanding || []).map((f) => `- ${f.label}`).join('\n');
  const diff = daysBetween(today, s.show_date);
  return {
    artist: str(s.artist),
    venue: str(s.venue_name),
    show_date: str(s.show_date),
    contact_name: str(s.dos_name),
    outstanding_items: items,
    days_to_show: diff === null ? '' : String(diff),
  };
}

/**
 * Tokens for the travel-confirmed (pickup) template — surfaces the artist's
 * flight arrival/departure for the promoter to coordinate ground transport.
 * @param {import('./types.mjs').Show} show
 * @returns {Object<string,string>}
 */
export function buildTravelTokens(show) {
  const s = show || {};
  return {
    artist: str(s.artist),
    venue: str(s.venue_name),
    show_date: str(s.show_date),
    contact_name: str(s.dos_name),
    arrival: str(s.landing_time),
    departure: str(s.takeoff_time),
  };
}

// Empty-safe stringifier: missing/blank -> '' (so a token never renders 'undefined').
function str(v) {
  return isEmpty(v) ? '' : String(v);
}
