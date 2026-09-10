// ============================================================================
// outstanding.js — THE CHASE CORE.
//   * computeOutstanding — which chaseable fields are required/active + empty +
//       overdue on a show that is still inside its chase window.
//   * shouldChase        — cadence gate (don't re-chase inside the min interval).
//   * isInChaseWindow    — show_date + graceDays >= today (scoped to live shows).
//   * travelConfirmedDue — the outbound travel-confirmed branch (fires on
//       flight-present, NOT empty+overdue; deduped by promoter_notified_flight).
// PURE: no Google calls, no ambient time — `today` is always injected.
// ============================================================================

import { CHASEABLE_OWNERS, REQUIRED, DEFAULT_BUCKETS, DEFAULTS, isEmpty } from './types.mjs';
import { isConditionActive } from './conditionals.mjs';
import { addDays, bucketDueDate } from './due-dates.mjs';
import { sectionToBucket } from './registry.mjs';

// Resolve the active bucket list, falling back to DEFAULT_BUCKETS. sectionToBucket
// (unlike the due-dates helpers) has no internal fallback, so resolve once here.
function outstandingBuckets(config) {
  const b = config && config.buckets;
  return Array.isArray(b) && b.length ? b : DEFAULT_BUCKETS;
}

function outstandingCadence(config) {
  return config && Number.isFinite(config.cadenceDays) ? config.cadenceDays : DEFAULTS.cadenceDays;
}

function outstandingGrace(config) {
  return config && Number.isFinite(config.graceDays) ? config.graceDays : DEFAULTS.graceDays;
}

/**
 * Is the show still in its chase window? show_date + graceDays >= today.
 * A show with no show_date, or whose grace window has passed, is out of window.
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').Config} config
 * @param {string} today 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isInChaseWindow(show, config, today) {
  if (!show || isEmpty(show.show_date) || isEmpty(today)) return false;
  const windowEnd = addDays(show.show_date, outstandingGrace(config));
  if (isEmpty(windowEnd)) return false;
  // 'YYYY-MM-DD' strings compare chronologically under lexical comparison.
  return windowEnd >= today;
}

/**
 * The fields outstanding (and chaseable) on a show as of `today`. A field is
 * included IFF:
 *   - its owner is chaseable (PROMOTER or ARTIST — never TRAVIS/AUTO),
 *   - it is required, OR conditional with its condition active,
 *   - its value on the show is empty,
 *   - its section maps to a timeline bucket whose due date is strictly < today.
 * The whole list is empty when the show is not chase_active or has passed its
 * grace window — so a cancelled or long-past show never drafts forever.
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').RegistryField[]} registry
 * @param {import('./types.mjs').Config} config
 * @param {string} today 'YYYY-MM-DD'
 * @returns {import('./types.mjs').RegistryField[]}
 */
export function computeOutstanding(show, registry, config, today) {
  if (!show || !Array.isArray(registry)) return [];
  if (!show.chase_active) return [];                 // Travis flipped it off
  if (!isInChaseWindow(show, config, today)) return []; // past grace / no date

  const buckets = outstandingBuckets(config);
  const out = [];

  for (const field of registry) {
    if (!field || !CHASEABLE_OWNERS.includes(field.owner)) continue; // PROMOTER/ARTIST only

    // required always counts; conditional only when its condition is active;
    // optional is never chased.
    if (field.required === REQUIRED.REQUIRED) {
      // chase
    } else if (field.required === REQUIRED.CONDITIONAL) {
      if (!isConditionActive(field, show)) continue;  // e.g. hotel not included
    } else {
      continue;                                       // optional / blank
    }

    if (!isEmpty(show[field.field_key])) continue;     // already provided

    const bucketName = sectionToBucket(field.section, buckets);
    if (!bucketName) continue;                         // non-chased section

    const due = bucketDueDate(bucketName, show, buckets);
    if (isEmpty(due)) continue;
    if (!(due < today)) continue;                      // not yet overdue (strict)

    out.push(field);
  }

  return out;
}

/**
 * Cadence gate: should the engine draft a chase now? True when there is at least
 * one outstanding field AND either no chase has been sent, or at least
 * cadenceDays have elapsed since the last one. (today − last_chase >= cadence,
 * expressed as last_chase + cadence <= today to reuse pure string date math.)
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').RegistryField[]} outstanding
 * @param {import('./types.mjs').Config} config
 * @param {string} today 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function shouldChase(show, outstanding, config, today) {
  if (!show || !Array.isArray(outstanding) || outstanding.length === 0) return false;
  if (isEmpty(show.last_chase_date)) return true;     // never chased -> go
  const nextAllowed = addDays(show.last_chase_date, outstandingCadence(config));
  if (isEmpty(nextAllowed)) return true;              // unparseable -> don't block
  return nextAllowed <= today;
}

/**
 * The outbound travel-confirmed branch. Fires on flight fields being PRESENT
 * (not empty+overdue): transport is included AND both flight takeoff and
 * landing times are filled AND the promoter hasn't already been notified.
 * `registry` is accepted for signature symmetry with the other chase-core fns.
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').RegistryField[]} registry
 * @returns {boolean}
 */
export function travelConfirmedDue(show, registry) {
  void registry; // Preserve the source API’s positional argument.
  if (!show) return false;
  const transport = isEmpty(show.transport_included) ? '' : String(show.transport_included).trim();
  if (transport !== 'yes') return false;
  if (isEmpty(show.takeoff_time) || isEmpty(show.landing_time)) return false;
  if (show.promoter_notified_flight) return false;
  return true;
}
