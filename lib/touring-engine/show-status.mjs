// ============================================================================
// show-status.js — B2 one-line status tri-state (SHARED PURE derivation).
//   advanced            — nothing outstanding (chase satisfied / off / past grace)
//   waiting-on-promoter — an outstanding required field is owned by the PROMOTER
//   waiting-on-artist   — an outstanding required field is owned by the ARTIST
//
// ONE derivation, TWO render sites: P6 renders it as the console Shows-list
// status column; P7 imports this SAME module to render the identical status on
// the Add-on card. Keeping it a single pure function is the mitigation for the
// "status drifts between surfaces" threat (T-06-06) — both sites compute, never
// store, the status, so they cannot disagree.
//
// PURE + FLATTEN-SAFE: top-level identifiers (deriveShowStatus, SHOW_STATUS,
// outstandingByOwner) are globally unique for the Apps Script flatten build. No
// store/adapter import and no ambient clock read — the clock arrives as the same
// injected `today` computeOutstanding takes. Status is DERIVED at read time and
// is never written onto the Show row.
// ============================================================================

import { computeOutstanding } from './outstanding.mjs';
import { OWNER } from './types.mjs';

/** The three derived states. Frozen so callers compare against shared values. */
export const SHOW_STATUS = Object.freeze({
  ADVANCED: 'advanced',
  WAITING_PROMOTER: 'waiting-on-promoter',
  WAITING_ARTIST: 'waiting-on-artist',
});

/**
 * Partition an outstanding-field list by chaseable owner. A small readability
 * helper over the tie-break; the public contract is deriveShowStatus.
 * @param {import('./types.mjs').RegistryField[]} outstanding
 * @returns {{ PROMOTER: import('./types.mjs').RegistryField[], ARTIST: import('./types.mjs').RegistryField[] }}
 */
export function outstandingByOwner(outstanding) {
  const by = { [OWNER.PROMOTER]: [], [OWNER.ARTIST]: [] };
  if (!Array.isArray(outstanding)) return by;
  for (const field of outstanding) {
    if (field && by[field.owner]) by[field.owner].push(field);
  }
  return by;
}

/**
 * Derive the one-line status for a show at read time from its owner-aware
 * outstanding list. Delegates entirely to computeOutstanding (does NOT
 * re-implement chase/window/overdue logic) and takes the same four arguments.
 *
 * Tie-break (BOTH owners outstanding -> waiting-on-promoter) is DELIBERATE: the
 * promoter holds the upstream blocker (venue/logistics) that gates advancing,
 * and the artist's day-sheet fields come later in the timeline — so "who am I
 * waiting on?" surfaces the promoter first.
 *
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').RegistryField[]} registry
 * @param {import('./types.mjs').Config} config
 * @param {string} today 'YYYY-MM-DD' (injected clock — never read here)
 * @returns {'advanced'|'waiting-on-promoter'|'waiting-on-artist'}
 */
export function deriveShowStatus(show, registry, config, today) {
  const outstanding = computeOutstanding(show, registry, config, today);
  if (!outstanding.length) return SHOW_STATUS.ADVANCED; // chase off / past grace / satisfied

  const by = outstandingByOwner(outstanding);
  if (by[OWNER.PROMOTER].length) return SHOW_STATUS.WAITING_PROMOTER; // promoter-first tie-break
  if (by[OWNER.ARTIST].length) return SHOW_STATUS.WAITING_ARTIST;

  // Defensive: computeOutstanding only emits CHASEABLE_OWNERS (PROMOTER/ARTIST),
  // so this is unreachable — but a non-empty list with no chaseable owner still
  // means there is something outstanding the promoter ultimately gates.
  return SHOW_STATUS.WAITING_PROMOTER;
}
