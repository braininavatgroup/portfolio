// Conditional field gating — is a registry field's inclusion condition satisfied
// by the current show? Pure: no I/O, no ambient time.
import { isEmpty } from './types.mjs';

/**
 * A field is "active" if it has no inclusion condition, OR its condition holds.
 * Non-conditional fields always return true. A conditional field is active only
 * when the show's gating field equals the required value
 * (e.g. transport_included === 'yes' gates the Transport section; hotel_included
 * === 'yes' gates Accommodation). Comparison is exact string equality after
 * trimming; an empty/missing gating value is never a match.
 *
 * @param {import('./types.mjs').RegistryField} field
 * @param {import('./types.mjs').Show} show
 * @returns {boolean}
 */
export function isConditionActive(field, show) {
  const cond = field && field.conditional_on;
  if (!cond) return true; // non-conditional -> always active
  const actual = show ? show[cond.field] : undefined;
  if (isEmpty(actual)) return false; // unanswered flag => condition not met
  return String(actual).trim() === String(cond.value).trim();
}
