import source from './demo-source.json' with { type: 'json' };
import registrySource from './registry-source.json' with { type: 'json' };
import { parseRegistry, fieldsForForm } from './registry.mjs';
import { deriveShowStatus } from './show-status.mjs';
import { computeOutstanding } from './outstanding.mjs';
import { projectDaySheet } from './daysheet.mjs';
import { planEvents } from './calendar-plan.mjs';
import { fieldWhitelist, sanitizeSubmission } from './tokens.mjs';
import { merge, buildChaseTokens } from './template-merge.mjs';
import { formatVenueDateTime } from './datetime-format.mjs';

const registry = parseRegistry(registrySource);
export const exampleTransport = Object.freeze({
  driver_name: 'Alex Reed',
  driver_number: '+1 212 555 0144',
  transfer_airport_hotel: 'Meet Alex at JFK arrivals at 14:30.',
});

export function createTouringShow() {
  return structuredClone(source.show);
}

// The portfolio owns only this in-memory interaction adapter. Field ownership,
// conditions, outstanding work and output projections come from the source tool.
export function savePromoterDetails(show, payload) {
  const visible = new Set(fieldsForForm(registry, 'promoter', show).map(f => f.field_key));
  const { accepted } = sanitizeSubmission(payload, fieldWhitelist(registry, 'promoter'));
  const patch = Object.fromEntries(Object.entries(accepted)
    .filter(([key, value]) => visible.has(key) && typeof value === 'string' && value.trim())
    .map(([key, value]) => [key, value.trim()]));
  return { ...show, ...patch };
}

export function touringEvidence(show, daySheetHref = '#touring-day-sheet') {
  const current = { ...show, pdf_link: daySheetHref };
  const outstanding = computeOutstanding(current, registry, source.config, source.today);
  return {
    status: deriveShowStatus(current, registry, source.config, source.today),
    date: formatVenueDateTime(current.show_date, current.timezone, { withLabel: false }),
    setTime: formatVenueDateTime(current.set_time, current.timezone),
    outstanding: outstanding.map(({ field_key, label, owner }) => ({ key: field_key, label, owner })),
    daySheet: projectDaySheet(current, registry),
    events: planEvents(current),
    draft: outstanding.length ? merge(source.config.templates.chase.body, buildChaseTokens(current, outstanding, source.today)) : null,
    promoterFields: fieldsForForm(registry, 'promoter', current).map(({field_key, label, type, section}) => ({key:field_key, label, type, section})),
  };
}

export function touringTime(value, timezone) {
  return formatVenueDateTime(value, timezone);
}
