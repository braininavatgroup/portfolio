// ============================================================================
// registry.js — the Field Registry parser + the three projections it drives:
//   * fieldsForView   — the day-sheet / advance view filter
//   * fieldsForForm   — which fields each intake form (promoter/artist) owns
//   * sectionToBucket — maps a registry section to its timeline bucket
// PURE: no Google calls, no ambient time. Enums come from ./types.mjs.
// ============================================================================

import { OWNER, VIEW, FORM_TYPE } from './types.mjs';

// Owner -> form type. PROMOTER/ARTIST own a form; TRAVIS/AUTO never do.
const OWNER_FOR_FORM = Object.freeze({
  [FORM_TYPE.PROMOTER]: OWNER.PROMOTER,
  [FORM_TYPE.ARTIST]: OWNER.ARTIST,
});

// --- CSV parsing -------------------------------------------------------------

/**
 * Split one CSV line into fields. Handles double-quoted fields (with escaped
 * "" and embedded commas) even though the v1 seed has none — cheap robustness
 * so a future label with a comma can't silently shift every column.
 * @param {string} line
 * @returns {string[]}
 */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parse a `field = value` conditional cell into {field, value}, or null.
 * Single equality only (v1 grammar — no AND/OR).
 * @param {string} raw
 * @returns {?{field:string, value:string}}
 */
function parseConditional(raw) {
  const s = (raw || '').trim();
  if (s === '') return null;
  const eq = s.indexOf('=');
  if (eq === -1) return null;
  const field = s.slice(0, eq).trim();
  const value = s.slice(eq + 1).trim();
  if (field === '') return null;
  return { field, value };
}

/**
 * Parse the Field Registry CSV (seed/field-registry-v1.csv) into RegistryField[].
 * Header row drives column order. Blank trailing lines are ignored.
 * @param {string} csvText
 * @returns {import('./types.mjs').RegistryField[]}
 */
export function parseRegistry(csvText) {
  const lines = String(csvText).split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const iKey = idx('field_key');
  const iLabel = idx('label');
  const iSection = idx('section');
  const iOwner = idx('owner');
  const iRequired = idx('required');
  const iCond = idx('conditional_on');
  const iView = idx('view');
  const iChurn = idx('high_churn');
  const iType = idx('type');

  const out = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = splitCsvLine(lines[r]);
    const field_key = (cols[iKey] || '').trim();
    if (field_key === '') continue;
    const viewRaw = (cols[iView] || '').trim();
    out.push({
      field_key,
      label: (cols[iLabel] || '').trim(),
      section: (cols[iSection] || '').trim(),
      owner: /** @type {import('./types.mjs').Owner} */ ((cols[iOwner] || '').trim()),
      required: /** @type {import('./types.mjs').RequiredLevel} */ ((cols[iRequired] || '').trim()),
      conditional_on: parseConditional(cols[iCond]),
      view: /** @type {import('./types.mjs').ViewTag} */ (viewRaw === '' ? null : viewRaw),
      high_churn: (cols[iChurn] || '').trim().toLowerCase() === 'high',
      type: (() => { const t = (iType === -1 ? '' : (cols[iType] || '')).trim().toLowerCase(); return t === '' ? 'text' : t; })(),
    });
  }
  return out;
}

// --- Projections -------------------------------------------------------------

/**
 * The timeline bucket name that gates a given section, or null if the section
 * is not chased (no bucket lists it).
 * @param {string} section
 * @param {import('./types.mjs').Bucket[]} buckets
 * @returns {string|null}
 */
export function sectionToBucket(section, buckets) {
  for (const b of buckets) {
    if (b.sections && b.sections.indexOf(section) !== -1) return b.name;
  }
  return null;
}

/**
 * Fields visible in a given view. 'Both' is included in every view.
 * @param {import('./types.mjs').RegistryField[]} registry
 * @param {'Advance'|'Day-Sheet'} view
 * @returns {import('./types.mjs').RegistryField[]}
 */
export function fieldsForView(registry, view) {
  return registry.filter((f) => f.view === view || f.view === VIEW.BOTH);
}

/**
 * Fields a given intake form owns: owner matches the form (PROMOTER->promoter,
 * ARTIST->artist), the field's conditional is active for this show, and it is
 * not an AUTO field. TRAVIS-owned fields never appear on a form.
 * @param {import('./types.mjs').RegistryField[]} registry
 * @param {'promoter'|'artist'} formType
 * @param {import('./types.mjs').Show} show
 * @returns {import('./types.mjs').RegistryField[]}
 */
export function fieldsForForm(registry, formType, show) {
  const owner = OWNER_FOR_FORM[formType];
  if (!owner) return [];
  return registry.filter((f) => {
    if (f.owner !== owner) return false;            // owner match (also excludes AUTO/TRAVIS)
    if (f.owner === OWNER.AUTO) return false;        // defensive: AUTO never on a form
    // conditional active: non-conditional -> always; conditional -> equality holds
    if (f.conditional_on) {
      return show[f.conditional_on.field] === f.conditional_on.value;
    }
    return true;
  });
}
