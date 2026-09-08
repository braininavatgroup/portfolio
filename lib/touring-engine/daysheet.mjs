// ============================================================================
// daysheet.js — the artist-facing day-sheet projection (View B).
//   One record, two views: the full promoter-facing advance and this filtered
//   artist day-sheet. The day-sheet is a PROJECTION of the show record, never a
//   second data-entry pass — it derives entirely from the Field Registry + the
//   show values.
// PURE: no Google calls, no ambient time. Imports its filters from siblings.
// ============================================================================

import { isEmpty } from './types.mjs';
import { isConditionActive } from './conditionals.mjs';
import { fieldsForView } from './registry.mjs';
import { formatVenueDateTime } from './datetime-format.mjs';
import { canonicalJson } from './signatures.mjs';

/**
 * Build the revision-aware day-sheet payload and signature.
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').RegistryField[]} registry
 * @returns {{data:Object,headerTokens:{artist:string,venue:string,show_date:string},signature:string}}
 */
export function buildDaySheetArtifact(show, registry) {
  const safeShow = show || {};
  const data = projectDaySheet(safeShow, registry || []);
  const headerTokens = {
    artist: safeShow.artist || '',
    venue: safeShow.venue_name || '',
    show_date: safeShow.show_date || '',
  };
  return {
    data,
    headerTokens,
    signature: canonicalJson({ headerTokens, data }),
  };
}

/**
 * Project a show into its artist day-sheet: sections of {label,value} pairs.
 *
 * A field appears IFF its view is Day-Sheet or Both AND its inclusion condition
 * is active for this show (e.g. no hotel rows when `hotel_included` !== 'yes',
 * no transport rows when `transport_included` !== 'yes'). That drops gear notes,
 * guest list, COI, marketing and status (all Advance-only or view-less) and the
 * conditional sections the seed flags switch off — no phantom rows.
 *
 * A whole section is dropped only when every one of its (active, view-matched)
 * fields is empty; a section with at least one filled field keeps all of its
 * active fields, including any still-empty ones (rendered for the artist to see
 * what's still outstanding). Sections and fields preserve registry order.
 *
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').RegistryField[]} registry
 * @returns {{ sections: {section:string, fields:{label:string,value:string}[]}[] }}
 */
export function projectDaySheet(show, registry) {
  const safeShow = show || {};
  // view in {Day-Sheet, Both} — fieldsForView folds 'Both' into every view.
  const viewFields = fieldsForView(registry || [], 'Day-Sheet');

  // Group active fields by section, preserving first-seen (registry) order.
  const order = [];
  const bySection = new Map();

  for (const field of viewFields) {
    if (!isConditionActive(field, safeShow)) continue; // conditional gating
    const section = field.section;
    if (!bySection.has(section)) {
      bySection.set(section, []);
      order.push(section);
    }
    const raw = safeShow[field.field_key];
    bySection.get(section).push({
      label: field.label,
      value: _dsFieldValue(field, raw, safeShow.timezone),
    });
  }

  const sections = [];
  for (const section of order) {
    const fields = bySection.get(section);
    // Drop a section only when ALL its fields are empty.
    if (fields.every((f) => isEmpty(f.value))) continue;
    sections.push({ section: _dsSectionLabel(section), fields });
  }

  // Considerate "Heads up" section — derived PURELY from the show's EXISTING
  // takeoff/landing times (no new fields, no fabricated contacts). Reads only the
  // wall-clock hour off the stored value (never parsed as a clock instant — the
  // value is zoneless wall-time per the datetime-format.js data contract).
  // Appended as an ordinary {label,value} section so every consumer (hub + P8 PDF)
  // renders it generically.
  const tz = safeShow.timezone;
  const headsUp = [];

  const landHour = _dsWallHour(safeShow.landing_time);
  if (landHour !== null && (landHour >= 22 || landHour <= 5)) {
    headsUp.push({
      label: 'Late arrival',
      value:
        'Your flight lands at ' +
        formatVenueDateTime(safeShow.landing_time, tz) +
        ' — plan for a late check-in and build rest in before your lobby call.',
    });
  }

  const takeHour = _dsWallHour(safeShow.takeoff_time);
  if (takeHour !== null && takeHour <= 5) {
    headsUp.push({
      label: 'Early departure',
      value:
        'Your flight leaves at ' +
        formatVenueDateTime(safeShow.takeoff_time, tz) +
        ' — arrange an early ride and a wake-up buffer.',
    });
  }

  // Emit only when at least one rule fires — no phantom section.
  if (headsUp.length > 0) {
    sections.push({ section: 'Heads up', fields: headsUp });
  }

  return { sections };
}

/**
 * Turn registry bucket identifiers into artist-facing section labels without
 * changing the identifiers used for grouping or configuration.
 * @param {*} value
 * @returns {string}
 */
function _dsSectionLabel(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The wall-clock hour (0-23) of a stored wall-time value, read DIRECTLY off the
 * digits after the date — never by parsing it as a clock instant (the value is
 * venue-local wall-time, not a UTC instant; parsing it as an instant yields a
 * machine-zone-dependent answer — datetime-format.js data contract). Accepts the
 * 'YYYY-MM-DDTHH:mm' / 'YYYY-MM-DD HH:mm' shapes the pickers emit. Returns null on
 * blank or non-datetime input (no clock to read). Globally-unique name.
 * @param {*} value
 * @returns {number|null}
 */
function _dsWallHour(value) {
  if (isEmpty(value)) return null;
  const m = /[T ](\d{2}):\d{2}/.exec(String(value));
  if (!m) return null;
  const hh = +m[1];
  return hh >= 0 && hh <= 23 ? hh : null;
}

/**
 * Produce a field's display value, registry-`type`-driven. Datetime/date/time
 * fields render through the shared P3 formatter (venue-local 12h text with a tz
 * label — never raw ISO); every other type passes through verbatim. Blank stays
 * blank (fallback ''), so the empty-section-drop rule is unaffected. This is the
 * single place legible dates are produced, so the hub AND the P8 PDF (both consume
 * this projection) get identical text. Globally-unique name (build-grammar).
 * @param {import('./types.mjs').RegistryField} field
 * @param {*} raw
 * @param {string} tz  show.timezone (IANA)
 * @returns {string}
 */
function _dsFieldValue(field, raw, tz) {
  if (isEmpty(raw)) return '';
  const t = field.type;
  if (t === 'datetime' || t === 'date' || t === 'time') {
    return formatVenueDateTime(raw, tz, { fallback: '' });
  }
  return String(raw);
}
