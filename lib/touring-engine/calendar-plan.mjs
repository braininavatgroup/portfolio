// Calendar planning. PURE: no Calendar/Google calls, no ambient time.
// Times on a Show are LOCAL WALL TIME ISO strings ('YYYY-MM-DDTHH:mm', no zone);
// we do clock arithmetic on them (anchored in UTC purely as a calculator) and
// emit them back unchanged in form — the venue `timezone` rides along on each
// PlannedEvent so the adapter interprets the wall time correctly.

import { isEmpty } from './types.mjs';

// Default event block lengths (minutes). Flights get a wider window because
// arrival/departure realistically spans deplaning + bags; a set is tighter.
const FLIGHT_BLOCK_MIN = 90;
const SET_BLOCK_MIN = 60;

// The three timed events, in stable order. Each maps a Show time field to a
// PlannedEvent `key` and a default block length.
const EVENT_SPECS = Object.freeze([
  { key: 'arrival', field: 'landing_time', minutes: FLIGHT_BLOCK_MIN },
  { key: 'departure', field: 'takeoff_time', minutes: FLIGHT_BLOCK_MIN },
  { key: 'set', field: 'set_time', minutes: SET_BLOCK_MIN },
]);

/**
 * Add `n` whole minutes to a local wall-time 'YYYY-MM-DDTHH:mm' string and
 * return the same shape. UTC is used only as a calculator — no zone is applied,
 * so the result is still wall time in the show's timezone.
 * @param {string} iso  'YYYY-MM-DDTHH:mm'
 * @param {number} n    minutes to add
 * @returns {string|null} 'YYYY-MM-DDTHH:mm' or null when unparseable
 */
export function addMinutesLocal(iso, n) {
  if (isEmpty(iso)) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m.map(Number);
  const t = Date.UTC(y, mo - 1, d, hh, mm, 0);
  const out = new Date(t + n * 60000);
  const yy = out.getUTCFullYear();
  const MM = String(out.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(out.getUTCDate()).padStart(2, '0');
  const HH = String(out.getUTCHours()).padStart(2, '0');
  const mi = String(out.getUTCMinutes()).padStart(2, '0');
  return `${yy}-${MM}-${dd}T${HH}:${mi}`;
}

/** Human summary line for one event key. */
function eventSummary(key, show) {
  const artist = isEmpty(show.artist) ? 'Artist' : String(show.artist).trim();
  const venue = isEmpty(show.venue_name) ? '' : String(show.venue_name).trim();
  switch (key) {
    case 'arrival':
      return `${artist} — Flight Arrival`;
    case 'departure':
      return `${artist} — Flight Departure`;
    case 'set':
      return venue ? `${artist} — Set @ ${venue}` : `${artist} — Set`;
    default:
      return artist;
  }
}

/**
 * Short day-sheet summary cached into the event description (convenience copy;
 * the PDF is authoritative). Only includes fields that are present.
 * @param {import('./types.mjs').Show} show
 * @returns {string}
 */
function eventDescription(show) {
  const lines = [];
  if (!isEmpty(show.venue_name)) lines.push(`Venue: ${String(show.venue_name).trim()}`);
  if (!isEmpty(show.venue_address)) lines.push(`Address: ${String(show.venue_address).trim()}`);
  if (!isEmpty(show.set_time)) lines.push(`Set: ${String(show.set_time).trim()}`);
  if (!isEmpty(show.landing_time)) lines.push(`Arrival: ${String(show.landing_time).trim()}`);
  if (!isEmpty(show.takeoff_time)) lines.push(`Departure: ${String(show.takeoff_time).trim()}`);
  if (!isEmpty(show.dos_name)) {
    const num = isEmpty(show.dos_number) ? '' : ` (${String(show.dos_number).trim()})`;
    lines.push(`Day-of contact: ${String(show.dos_name).trim()}${num}`);
  }
  if (!isEmpty(show.pdf_link)) {
    lines.push(`Day sheet: ${String(show.pdf_link).trim()}`);
  }
  return lines.join('\n');
}

/**
 * One timed PlannedEvent per present time among landing_time / takeoff_time /
 * set_time. Missing times are skipped. Flights default to a 90-min block, the
 * set to 60 min. All events carry the venue timezone.
 * @param {import('./types.mjs').Show} show
 * @param {import('./types.mjs').RegistryField[]} [registry]  accepted for signature symmetry; not required
 * @returns {import('./types.mjs').PlannedEvent[]}
 */
export function planEvents(show /* , registry */) {
  if (!show) return [];
  const tz = isEmpty(show.timezone) ? '' : String(show.timezone).trim();
  const artistEmail = isEmpty(show.artist_email) ? '' : String(show.artist_email).trim();
  const description = eventDescription(show);
  const events = [];

  for (const spec of EVENT_SPECS) {
    const start = show[spec.field];
    if (isEmpty(start)) continue; // skip missing times
    const end = addMinutesLocal(start, spec.minutes);
    if (end === null) continue; // unparseable time — skip rather than emit garbage
    events.push({
      key: spec.key,
      start: String(start).trim(),
      end,
      timezone: tz,
      summary: eventSummary(spec.key, show),
      description,
      artistEmail,
    });
  }
  return events;
}

/**
 * Diff a freshly-planned event set against the event IDs already stored on the
 * show (key -> eventId). Decides what to create, patch, and delete.
 *   - create: a planned key with no existing eventId
 *   - patch:  a planned key that already has an eventId
 *   - delete: an existing eventId whose key is no longer planned
 * @param {import('./types.mjs').PlannedEvent[]} planned
 * @param {Object<string,string>} existingIds  { arrival, departure, set } -> eventId
 * @returns {{toCreate: import('./types.mjs').PlannedEvent[], toPatch: {key:string,event:import('./types.mjs').PlannedEvent,eventId:string}[], toDelete: string[]}}
 */
export function diffEvents(planned, existingIds) {
  const plan = Array.isArray(planned) ? planned : [];
  const existing = existingIds && typeof existingIds === 'object' ? existingIds : {};

  const toCreate = [];
  const toPatch = [];
  const plannedKeys = new Set();

  for (const event of plan) {
    plannedKeys.add(event.key);
    const eventId = existing[event.key];
    if (isEmpty(eventId)) {
      toCreate.push(event);
    } else {
      toPatch.push({ key: event.key, event, eventId });
    }
  }

  const toDelete = [];
  for (const key of Object.keys(existing)) {
    const eventId = existing[key];
    if (isEmpty(eventId)) continue;
    if (!plannedKeys.has(key)) toDelete.push(eventId);
  }

  return { toCreate, toPatch, toDelete };
}
