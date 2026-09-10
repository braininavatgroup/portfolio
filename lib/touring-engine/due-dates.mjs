// Due-date math for the timeline buckets. PURE: no ambient time, no Google.
// Date arithmetic anchors at UTC noon so that adding/subtracting whole days can
// never cross a day boundary via DST/timezone drift — we only ever read the
// UTC calendar date back out.

import { DEFAULT_BUCKETS, isEmpty } from './types.mjs';

/**
 * Add `n` whole days to a date, returning a date-only 'YYYY-MM-DD' string.
 * Anchors at UTC noon to avoid any timezone/DST drift across the day boundary.
 * Accepts a date-only ('YYYY-MM-DD') or local-datetime ('YYYY-MM-DDTHH:mm')
 * ISO string; only the calendar date portion is used.
 * @param {string} iso
 * @param {number} n
 * @returns {string} 'YYYY-MM-DD'
 */
export function addDays(iso, n) {
  if (isEmpty(iso)) return null;
  const datePart = String(iso).slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  // Noon UTC anchor — immune to TZ/DST shifts when adding whole days.
  const t = Date.UTC(y, m - 1, d, 12, 0, 0);
  const out = new Date(t + n * 86400000);
  const yy = out.getUTCFullYear();
  const mm = String(out.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(out.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Resolve the active bucket list, falling back to DEFAULT_BUCKETS. */
function resolveBuckets(buckets) {
  return Array.isArray(buckets) && buckets.length ? buckets : DEFAULT_BUCKETS;
}

/**
 * Concrete due date for one timeline bucket on a given show.
 * Override (show.due_date_overrides[bucketName]) wins over show_date − offset.
 * @param {string} bucketName
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').Bucket[]} [buckets]
 * @returns {string|null} 'YYYY-MM-DD' or null
 */
export function bucketDueDate(bucketName, show, buckets) {
  if (!show || isEmpty(bucketName)) return null;

  // Override wins, unconditionally, when present and non-empty.
  const overrides = show.due_date_overrides;
  if (overrides && !isEmpty(overrides[bucketName])) {
    return overrides[bucketName];
  }

  const list = resolveBuckets(buckets);
  const bucket = list.find((b) => b.name === bucketName);
  if (!bucket || isEmpty(show.show_date)) return null;

  return addDays(show.show_date, -bucket.offset);
}

/**
 * Due date for a registry field, routed via its section -> bucket -> due date.
 * Returns null when the field's section is gated by no bucket (non-chased).
 * @param {import('./types.mjs').RegistryField} field
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').Bucket[]} [buckets]
 * @returns {string|null} 'YYYY-MM-DD' or null
 */
export function fieldDueDate(field, show, buckets) {
  if (!field || isEmpty(field.section)) return null;
  const list = resolveBuckets(buckets);
  const bucket = list.find(
    (b) => Array.isArray(b.sections) && b.sections.includes(field.section)
  );
  if (!bucket) return null;
  return bucketDueDate(bucket.name, show, list);
}
