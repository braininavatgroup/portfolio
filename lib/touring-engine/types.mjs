// ============================================================================
// CANONICAL TYPE + CONSTANT CONTRACT  —  the keystone every module builds to.
// ----------------------------------------------------------------------------
// CROSS-ENVIRONMENT BUILD PATTERN (LOCKED — do not deviate):
//   * Source files under src/ are ES modules (`export function ...`,
//     `import {...} from './sibling.mjs'`). vitest tests import them directly.
//   * Apps Script has NO module system (one global namespace). `scripts/build.mjs`
//     strips `export ` and deletes `import ...` lines, flattening every file into
//     build/ which clasp pushes (.clasp.json rootDir = "build").
//   * THEREFORE every exported function name MUST be globally unique across all
//     of src/ (after flattening they share one scope). Prefix where ambiguous.
//   * Core modules (src/core/*) are PURE: no Gmail/Calendar/Drive/Sheet calls,
//     no Date.now()/new Date() without an injected `today`/`now`. All I/O lives
//     in src/adapters/*. This is what makes the core unit-testable in Node.
// ============================================================================

/** @typedef {'TRAVIS'|'PROMOTER'|'ARTIST'|'AUTO'} Owner */
/** @typedef {'required'|'optional'|'conditional'} RequiredLevel */
/** @typedef {'Advance'|'Day-Sheet'|'Both'|null} ViewTag */

/**
 * One row of the Field Registry (the table that drives forms, day-sheet, chase).
 * @typedef {Object} RegistryField
 * @property {string} field_key            unique column key (e.g. 'venue_name')
 * @property {string} label                human label
 * @property {string} section              e.g. 'Show/Venue', 'Travel', 'GuestList'
 * @property {Owner} owner
 * @property {RequiredLevel} required
 * @property {?{field:string,value:string}} conditional_on  single equality, or null
 * @property {ViewTag} view
 * @property {boolean} high_churn
 * @property {'text'|'date'|'datetime'|'time'|'email'|'tel'|'number'|'textarea'|'yesno'} type  input widget hint (default 'text'); 'yesno' renders a Yes/No dropdown
 */

/**
 * One timeline bucket (Config tab 2). Offset = days before show_date.
 * @typedef {Object} Bucket
 * @property {string} name        e.g. 'tech','logistics','travel','guestlist','daysheet','kickoff'
 * @property {number} offset      days before show_date (positive int)
 * @property {string[]} sections  registry sections this bucket gates
 */

/**
 * A show record (one artist × one show). Plain map of field_key -> value plus
 * the system fields below. Empty/missing field => '' or undefined (treated equal).
 * Times are LOCAL WALL TIME ISO strings ('YYYY-MM-DDTHH:mm', no zone suffix);
 * interpret them in `timezone`. `show_date` is a date-only 'YYYY-MM-DD'.
 * @typedef {Object} Show
 * @property {string} show_id
 * @property {string} show_date              'YYYY-MM-DD'
 * @property {string} timezone               IANA zone, e.g. 'America/New_York' (seed default = Travis's)
 * @property {boolean} chase_active
 * @property {Object<string,string>} due_date_overrides  bucketName -> 'YYYY-MM-DD'
 * @property {?string} last_chase_date       'YYYY-MM-DD' or null
 * @property {?string} chase_draft_id
 * @property {boolean} promoter_notified_flight
 * @property {Object<string,string>} gcal_event_ids      {arrival,departure,set} -> eventId
 * @property {Object<string,string>} gcal_event_signatures  {arrival,departure,set} -> canonical event JSON
 * @property {string} daysheet_signature
 * @property {string} daysheet_draft_signature
 * @property {string} pdf_file_id
 * @property {string} [takeoff_time]         'YYYY-MM-DDTHH:mm' local
 * @property {string} [landing_time]         'YYYY-MM-DDTHH:mm' local
 * @property {string} [set_time]             'YYYY-MM-DDTHH:mm' local
 * // ...plus every other registry field_key as a string value.
 */

/**
 * Engine config, read live from the Sheet config tabs.
 * @typedef {Object} Config
 * @property {Bucket[]} buckets
 * @property {number} cadenceDays            min days between chases to one show
 * @property {number} graceDays              keep chasing this many days past show_date
 * @property {Object<string,Template>} templates   keyed: 'chase', 'travel_confirmed', 'promoter_advance', 'artist_intake'
 * @property {number} glAllotmentDefault     placeholder N (≈2) until promoter gives real count
 */

/** @typedef {Object} Template
 * @property {string} [subject]  present for fresh sends (artist intake); omit for in-thread replies
 * @property {string} body       contains {{tokens}}
 */

/** A calendar event the tool should create/patch.
 * @typedef {Object} PlannedEvent
 * @property {'arrival'|'departure'|'set'} key
 * @property {string} start      'YYYY-MM-DDTHH:mm' local wall time
 * @property {string} end        'YYYY-MM-DDTHH:mm' local wall time
 * @property {string} timezone   IANA zone
 * @property {string} summary
 * @property {string} description
 * @property {string} artistEmail
 */

// --- Canonical enum values (use these, never string literals scattered) ------
export const OWNER = Object.freeze({ TRAVIS: 'TRAVIS', PROMOTER: 'PROMOTER', ARTIST: 'ARTIST', AUTO: 'AUTO' });
export const REQUIRED = Object.freeze({ REQUIRED: 'required', OPTIONAL: 'optional', CONDITIONAL: 'conditional' });
export const VIEW = Object.freeze({ ADVANCE: 'Advance', DAYSHEET: 'Day-Sheet', BOTH: 'Both' });
export const FORM_TYPE = Object.freeze({ PROMOTER: 'promoter', ARTIST: 'artist' });

// Token `form_type` values that are NOT per-show form tokens. A dashboard token
// authorizes an ARTIST (all their shows), is reusable (never marked `used`), and
// stores the artist name in the token store's `show_id`/subject column.
export const TOKEN_TYPE = Object.freeze({ ARTIST_DASHBOARD: 'artist_dashboard' });

// Owners that get chased / appear on a form (AUTO + TRAVIS never chased).
export const CHASEABLE_OWNERS = Object.freeze(['PROMOTER', 'ARTIST']);

// Default timeline buckets (placeholders — Travis confirms in the Audit).
// offset = days before show_date.
export const DEFAULT_BUCKETS = Object.freeze([
  { name: 'kickoff',   offset: 21, sections: [] },
  { name: 'tech',      offset: 14, sections: ['Show/Venue', 'Contacts', 'Tech', 'Hospitality', 'Compliance'] },
  { name: 'logistics', offset: 10, sections: ['Transport', 'Accommodation'] },
  { name: 'travel',    offset: 7,  sections: ['Travel'] },
  { name: 'guestlist', offset: 3,  sections: ['GuestList'] },
  { name: 'daysheet',  offset: 2,  sections: ['(render)'] },
]);

// Sections that are never chased (no bucket).
export const NON_CHASED_SECTIONS = Object.freeze([
  'Identity', 'Flags', 'TravelingParty', 'Control', 'System', 'Marketing',
]);

export const DEFAULTS = Object.freeze({
  cadenceDays: 3,
  graceDays: 1,
  glAllotmentDefault: 2,
});

// True if a field value counts as "empty" (missing/blank/whitespace).
export function isEmpty(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}
