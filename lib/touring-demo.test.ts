import { describe, expect, it } from 'vitest';
import { createTouringShow, exampleTransport, savePromoterDetails, touringEvidence } from './touring-engine/demo.mjs';

describe('Touring work sample', () => {
  it('carries a partial promoter answer through outstanding work, the draft, and the day sheet', () => {
    const initial = createTouringShow();
    expect(touringEvidence(initial).outstanding.map(f => f.key)).toEqual(['driver_name', 'transfer_airport_hotel']);
    const partial = savePromoterDetails(initial, {driver_name:'Alex Reed'});
    const evidence = touringEvidence(partial);
    expect(evidence.status).toBe('waiting-on-promoter');
    expect(evidence.outstanding.map(f => f.key)).toEqual(['transfer_airport_hotel']);
    expect(evidence.draft).not.toContain('- Driver Name');
    expect(evidence.draft).toContain('- Ride from airport to hotel');
    expect(evidence.daySheet.sections.flatMap(s=>s.fields)).toContainEqual({label:'Driver Name', value:'Alex Reed'});
    expect(initial.driver_name).toBe('');
  });
  it('completes the same record, removes the follow-up, and preserves changes on a repeated save', () => {
    const show = savePromoterDetails(createTouringShow(), exampleTransport);
    const evidence = touringEvidence(show);
    expect(evidence.outstanding).toEqual([]);
    expect(evidence.draft).toBeNull();
    expect(evidence.status).toBe('advanced');
    expect(savePromoterDetails(show, exampleTransport)).toEqual(show);
    expect(savePromoterDetails(show, {driver_name:'   '})).toEqual(show);
    expect(createTouringShow().driver_name).toBe('');
  });
  it('uses the edited venue and set time in the day sheet and Calendar event, with a working local day-sheet target', () => {
    const show = savePromoterDetails(createTouringShow(), {venue_name:'Demo Hall', set_time:'2026-10-16T22:00'});
    const evidence = touringEvidence(show, '#sample-day-sheet');
    const event = evidence.events.find(e=>e.key==='set');
    expect(event?.start).toBe('2026-10-16T22:00');
    expect(event?.summary).toContain('Demo Hall');
    expect(event?.description).toContain('Day sheet: #sample-day-sheet');
    expect(evidence.daySheet.sections.flatMap(s=>s.fields)).toContainEqual({label:'Venue Name',value:'Demo Hall'});
  });
  it('honors field ownership and conditional exclusions from the original registry', () => {
    const initial = createTouringShow();
    const after = savePromoterDetails(initial, {artist:'Another artist', artist_email:'other@example.com', hotel_name:'Excluded hotel', driver_name:'Alex Reed'});
    expect(after.artist).toBe(initial.artist);
    expect(after.artist_email).toBe(initial.artist_email);
    expect(after.hotel_name).toBe('');
    expect(after.driver_name).toBe('Alex Reed');
    expect(touringEvidence(after).daySheet.sections.some(s=>/accommodation/i.test(s.section))).toBe(false);
  });
});
