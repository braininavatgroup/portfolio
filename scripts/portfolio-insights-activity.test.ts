import { describe, expect, it } from 'vitest';
import { portfolioActivity } from './portfolio-insights-activity.mjs';

const event = (action: string, extra = {}) => ({ timestamp: '2026-10-13T18:00:00.000Z', action,
  schema: 'v2', sessionId: 'anonymous-tab-one', campaign: '', contentId: '', contentKind: 'record',
  contactKind: '', source: '', targetId: '', targetKind: '', country: 'US', regionCode: 'NY',
  city: 'New York City', metroCode: '501', device: 'desktop', activeSeconds: 0, completionPercent: 0, ...extra });
const content = { records: {}, threads: {} };

describe('private portfolio activity projection', () => {
  it('ignores entries and instant complete-scroll snapshots', async () => {
    expect(await portfolioActivity([event('entry'), event('content_attention', { contentId: 'bradley', activeSeconds: 1, completionPercent: 100 })], content)).toEqual([]);
  });
  it('requires active reading in two distinct projects, not repeated opens', async () => {
    const first = [event('content_open', { contentId: 'dubs' }), event('content_attention', { contentId: 'dubs', activeSeconds: 15 }), event('content_open', { contentId: 'dubs' })];
    expect(await portfolioActivity(first, content)).toEqual([]);
    const two = [...first, event('content_open', { contentId: 'touring' }), event('content_attention', { contentId: 'touring', activeSeconds: 15 })];
    expect(await portfolioActivity(two, content)).toMatchObject([{ kind: 'projects', contents: ['dubs', 'touring'], activeSeconds: 30 }]);
  });
  it('keeps CV clicks, supporting evidence and Guide navigation distinct', async () => {
    expect(await portfolioActivity([event('contact_action', { contactKind: 'cv' })], content)).toMatchObject([{ kind: 'cv' }]);
    expect(await portfolioActivity([event('evidence_open')], content)).toMatchObject([{ kind: 'evidence' }]);
    expect(await portfolioActivity([event('guide_evidence', { targetKind: 'record', targetId: 'dubs' })], content)).toMatchObject([{ kind: 'guide' }]);
    expect(await portfolioActivity([event('guide_evidence', { targetKind: 'thread', targetId: 'thread-making-work-playable' })], content)).toMatchObject([{ kind: 'guide' }]);
    expect(await portfolioActivity([event('guide_evidence', { targetKind: 'home' })], content)).toEqual([]);
    expect(await portfolioActivity([event('guide_evidence', { targetKind: 'record', targetId: '' })], content)).toEqual([]);
  });
  it('labels the Guide destination, not the ambient previously selected work', async () => {
    const p = await portfolioActivity([event('guide_evidence', { targetKind: 'record', targetId: 'dubs', contentId: 'touring' })], content);
    expect(p[0].contents).toEqual(['dubs']); expect(p[0].steps[0].content).toBe('dubs');
  });
  it('deduplicates the tab across snapshots and sums attention maxima, not snapshots', async () => {
    const rows = [event('contact_action', { contactKind: 'cv' }), event('content_attention', { contentId: 'dubs', activeSeconds: 15 }), event('content_attention', { contentId: 'dubs', activeSeconds: 30 })];
    const initial = await portfolioActivity(rows, content);
    const later = await portfolioActivity([...rows, event('content_attention', { contentId: 'dubs', activeSeconds: 35, timestamp: '2026-10-13T18:05:00.000Z' })], content);
    expect(initial[0].id).toBe(later[0].id); expect(initial[0].activeSeconds).toBe(30); expect(later[0].activeSeconds).toBe(35);
    expect(JSON.stringify(later)).not.toContain('anonymous-tab-one');
  });
  it('quarantines conflicting campaigns and never joins sessionless rows', async () => {
    expect(await portfolioActivity([event('contact_action', { contactKind: 'cv', sessionId: '' })], content)).toEqual([]);
    expect(await portfolioActivity([event('contact_action', { contactKind: 'cv', campaign: 'code-a' }), event('entry', { campaign: 'code-b' })], content)).toEqual([]);
  });
});
