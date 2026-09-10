// ============================================================================
// datetime-format.js — the shared render-time datetime formatter. PURE core.
// ----------------------------------------------------------------------------
// ROLE: the single entry point every surface (forms, hub, email, PDF, calendar)
// calls to turn a stored time value into human 12-hour text with a tz label —
// e.g. "Sat, Jun 1 · 11:00 PM EDT". It is the highest-fan-in pure module in the
// project; the P3 success criterion ("no raw ISO on any surface") rides on it.
//
// THE LOAD-BEARING DATA CONTRACT (read before touching this file):
//   Show times in this codebase are LOCAL WALL-TIME ISO strings with NO zone
//   suffix ('YYYY-MM-DDTHH:mm'); the venue IANA zone rides alongside on
//   `show.timezone`. The input is therefore NOT a UTC instant. You must NOT do
//   `new Date('2026-06-01T23:00')` and reformat — a zoneless string is parsed as
//   the *runtime machine's* local time (CF Workers run at TZ=UTC, Apps Script at
//   America/New_York, dev machines at whatever), so that path yields a DIFFERENT
//   answer on each runtime. The wall components are already venue-local; the only
//   thing that needs a real instant is choosing the DST-correct abbreviation
//   (EDT vs EST). We treat UTC strictly as a calculator (the same idiom as
//   due-dates.js / calendar-plan.js / template-merge.js), which makes this module
//   IMMUNE to the ambient machine timezone — Node / workerd / Apps Script V8 agree.
//
// PURE classification (src/core/*): no Google calls, no ambient clock
// (no Date.now() / new Date()-from-clock). Intl.DateTimeFormat + Date.UTC(...)
// used only as a deterministic calculator are idiomatic and allowed here.
//
// §3.4 BOUNDED-DST-ABBREVIATION CAVEAT (intentional tradeoff):
//   The abbreviation is read from the pseudo-UTC instant, so it can disagree with
//   the true wall-time abbreviation only WITHIN the ~1-6h window around a DST
//   transition, and only for the abbreviation token — never the date or the time.
//     | Wall time (NY)     | Label | Note                                          |
//     | 2026-03-08T14:00   | EDT   | afternoon of spring-forward — correct         |
//     | 2026-03-08T02:30   | EST   | 2:30 AM doesn't exist that day; approx by def. |
//     | 2026-11-01T01:30   | EDT   | fall-back ambiguous hour (twice); emits EDT    |
//   This matches the codebase's UTC-as-calculator stance; offset-exact labels
//   would require persisting the offset at capture time (out of scope here).
//
// BUILD-GRAMMAR (enforced by scripts/build.mjs): `export function` only — no
// `export default`, no `export { }` lists. Every TOP-LEVEL identifier (exports
// AND private helpers) must be globally unique across src/ (flattened into one
// Apps Script scope), hence the `_dtf*` prefixes. Requires the V8 runtime (Intl).
// ============================================================================

import { isEmpty } from './types.mjs';

// U+00B7 middle dot between date and time; U+2013 en dash between range sides.
const _DTF_DOT = '·';
const _DTF_DASH = '–';

/**
 * Format a venue-local wall-time value into human 12-hour text with a tz label.
 * The single entry point every surface calls. NEVER echoes the raw input.
 *
 * @param {string} value  full datetime 'YYYY-MM-DDTHH:mm' (also ' ' separator and
 *        trailing ':ss'/fractional — seconds dropped), date-only 'YYYY-MM-DD',
 *        time-only 'HH:mm'/'THH:mm', or a zoned instant ('...Z' / '...±HH:mm').
 * @param {string} tz     IANA zone, e.g. 'America/New_York' (from show.timezone).
 * @param {{fallback?:string, withLabel?:boolean}} [opts]
 *        fallback  : returned for blank/unparseable input. Default ''. Pass '—'
 *                    on display surfaces (hub/forms) for an em-dash.
 *        withLabel : include the tz abbreviation on datetime output. Default true.
 *                    Forms set false for the show_date context line.
 * @returns {string}  e.g. "Sat, Jun 1 · 11:00 PM EDT". NEVER the raw ISO.
 */
export function formatVenueDateTime(value, tz, opts = {}) {
  const fallback = opts.fallback ?? '';
  const withLabel = opts.withLabel !== false; // default true

  const det = _dtfDetect(value);
  if (!det) return fallback;

  // Build the wall date/time strings from a pseudo-UTC instant (UTC formatter on
  // a UTC-anchored instant ⇒ the wall components survive verbatim, machine-zone
  // independent). Manual assembly is load-bearing: a single all-options Intl
  // format yields comma form ("Mon, Jun 1, 11:00 PM EDT"), not the `·` shape.
  if (det.kind === 'zoned') {
    return _dtfZoned(det.value, tz, withLabel, fallback);
  }

  if (det.kind === 'date') {
    // A bare calendar date carries no clock ⇒ no zone ⇒ label forced off.
    const { date } = _dtfParts(det.y, det.mo, det.d, 12, 0);
    return date;
  }

  if (det.kind === 'time') {
    // No date ⇒ DST cannot be resolved ⇒ abbreviation omitted (edge guard).
    const { time } = _dtfParts(2000, 1, 1, det.hh, det.mm);
    return time;
  }

  // det.kind === 'datetime'
  const { pseudo, date, time } = _dtfParts(det.y, det.mo, det.d, det.hh, det.mm);
  const abbr = withLabel ? _dtfAbbrev(pseudo, tz) : '';
  return abbr ? `${date} ${_DTF_DOT} ${time} ${abbr}` : `${date} ${_DTF_DOT} ${time}`;
}

/**
 * Format a start→end pair (calendar blocks, venue open/close hours). Collapses a
 * shared date and a shared tz label on same-day spans; shows both sides when the
 * dates differ or one side is blank.
 *
 *   same day         -> "Mon, Jun 1 · 11:00 PM – 11:59 PM EDT"
 *   crosses midnight -> "Mon, Jun 1 · 11:00 PM EDT – Tue, Jun 2 · 1:00 AM EDT"
 *   one side blank   -> single-sided formatVenueDateTime of the present side
 *   both blank       -> opts.fallback
 *
 * @param {string} startValue
 * @param {string} endValue
 * @param {string} tz
 * @param {{fallback?:string, separator?:string}} [opts]  separator default ' – '.
 * @returns {string}
 */
export function formatVenueTimeRange(startValue, endValue, tz, opts = {}) {
  const fallback = opts.fallback ?? '';
  const sep = opts.separator ?? ` ${_DTF_DASH} `;

  const startEmpty = isEmpty(startValue);
  const endEmpty = isEmpty(endValue);
  if (startEmpty && endEmpty) return fallback;
  if (endEmpty) return formatVenueDateTime(startValue, tz, { fallback });
  if (startEmpty) return formatVenueDateTime(endValue, tz, { fallback });

  const a = _dtfDetect(startValue);
  const b = _dtfDetect(endValue);

  // Same-day collapse only when BOTH are full datetimes on the same calendar date.
  if (a && b && a.kind === 'datetime' && b.kind === 'datetime'
      && a.y === b.y && a.mo === b.mo && a.d === b.d) {
    const { pseudo, date, time: startTime } = _dtfParts(a.y, a.mo, a.d, a.hh, a.mm);
    const { time: endTime } = _dtfParts(b.y, b.mo, b.d, b.hh, b.mm);
    const abbr = _dtfAbbrev(pseudo, tz);
    const body = `${date} ${_DTF_DOT} ${startTime} ${_DTF_DASH} ${endTime}`;
    return abbr ? `${body} ${abbr}` : body;
  }

  // Differing dates (or non-datetime kinds): show both fully-formatted sides.
  const left = formatVenueDateTime(startValue, tz, { fallback });
  const right = formatVenueDateTime(endValue, tz, { fallback });
  return `${left}${sep}${right}`;
}

/**
 * Detection (§2.2) against String(value).trim() with range validation, so garbage
 * falls through to a fallback rather than an Intl rollover. Globally-unique name.
 * @returns {null | {kind:'zoned',value:string} | {kind:'datetime',y,mo,d,hh,mm}
 *           | {kind:'date',y,mo,d} | {kind:'time',hh,mm}}
 */
function _dtfDetect(value) {
  if (isEmpty(value)) return null; // no-leak guarantee starts here
  const s = String(value).trim();

  // Zoned instant: trailing Z, or a ±HH:mm / ±HHmm offset after a time.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s) && /\d{2}:\d{2}/.test(s)) {
    return { kind: 'zoned', value: s };
  }

  // Full datetime 'YYYY-MM-DD'['T'|' ']'HH:mm' (trailing seconds/fraction ignored).
  let m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3], hh = +m[4], mm = +m[5];
    if (_dtfInRange(mo, d, hh, mm)) return { kind: 'datetime', y, mo, d, hh, mm };
    return null;
  }

  // Date-only 'YYYY-MM-DD'.
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (_dtfInRange(mo, d, 0, 0)) return { kind: 'date', y, mo, d };
    return null;
  }

  // Time-only 'HH:mm' or 'THH:mm'.
  m = /^T?(\d{2}):(\d{2})$/.exec(s);
  if (m) {
    const hh = +m[1], mm = +m[2];
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return { kind: 'time', hh, mm };
    return null;
  }

  return null; // never echo the raw input
}

/** Range guard: mo 1-12, d 1-31, hh 0-23, mm 0-59. Globally-unique name. */
function _dtfInRange(mo, d, hh, mm) {
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31
    && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

/**
 * Build display components from wall components via a pseudo-UTC instant. The
 * date/time formatters use timeZone:'UTC' so the clock is NOT shifted (instant
 * and format-zone are both UTC ⇒ the wall components survive verbatim).
 * Globally-unique name. Locale pinned 'en-US' for letter abbreviations + the
 * exact punctuation ("Mon, Jun 1", "11:00 PM").
 */
function _dtfParts(y, mo, d, hh, mm) {
  const pseudo = new Date(Date.UTC(y, mo - 1, d, hh, mm));
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
  }).format(pseudo);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(pseudo);
  return { pseudo, date, time };
}

/**
 * The DST-correct tz abbreviation — the only place the wall-time path touches
 * Intl with the real zone. Reads from a pseudo-instant in `tz`; '' on blank or
 * invalid IANA zone (never throws ⇒ label simply omitted). Globally-unique name.
 */
function _dtfAbbrev(instant, tz) {
  if (isEmpty(tz)) return '';
  try {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, timeZoneName: 'short', hour: 'numeric',
    }).formatToParts(instant).find((x) => x.type === 'timeZoneName');
    return p ? p.value : '';
  } catch {
    return ''; // invalid IANA zone -> no label, never throw
  }
}

/**
 * Defensive zoned-instant branch (§2.4): the value carries an explicit Z/offset,
 * so it is a TRUE instant — parse with new Date(value) (safe, zone explicit) and
 * convert INTO `tz`. The ONLY place this module does a real zone conversion.
 * Assembled via formatToParts (NOT a plain .format(), which yields comma form).
 * Globally-unique name.
 */
function _dtfZoned(value, tz, withLabel, fallback) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return fallback;
  const zone = isEmpty(tz) ? 'UTC' : tz;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
    }).formatToParts(instant);
    const get = (type) => {
      const p = parts.find((x) => x.type === type);
      return p ? p.value : '';
    };
    const date = `${get('weekday')}, ${get('month')} ${get('day')}`;
    const time = `${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
    const abbr = withLabel ? get('timeZoneName') : '';
    return abbr ? `${date} ${_DTF_DOT} ${time} ${abbr}` : `${date} ${_DTF_DOT} ${time}`;
  } catch {
    return fallback; // invalid zone on a zoned instant -> fallback, never echo
  }
}
