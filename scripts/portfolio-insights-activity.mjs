import { groupJourneys, contentCatalogFromPortfolioContent } from './portfolio-insights-intelligence.mjs';

export async function portfolioActivity(events, content) {
  const catalog = contentCatalogFromPortfolioContent(content);
  const items = [];
  for (const journey of groupJourneys(events)) {
    const opened = [...new Set(journey.events.filter(e => e.action === 'content_open').map(e => e.contentId).filter(id => id && id !== 'bradley'))];
    const attention = new Map();
    for (const event of journey.events.filter(e => e.action === 'content_attention')) {
      attention.set(event.contentId, Math.max(attention.get(event.contentId) || 0, event.activeSeconds));
    }
    const cv = journey.contactKinds.includes('cv');
    const evidence = journey.events.some(e => e.action === 'evidence_open');
    const guide = journey.events.some(e => e.action === 'guide_evidence');
    const explored = opened.filter(id => (attention.get(id) || 0) > 0).length >= 2;
    if (!cv && !evidence && !guide && !explored) continue;
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`portfolio-activity/v1:${journey.sessionId}`));
    const label = id => catalog[`record:${id}`]?.label || catalog[`thread:${id}`]?.label || id;
    items.push({
      id: Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join(''),
      campaign: journey.campaignCode,
      startedAt: journey.entryAt,
      lastAt: journey.events.at(-1).timestamp,
      kind: cv ? 'cv' : evidence ? 'evidence' : guide ? 'guide' : 'projects',
      contents: opened.map(label),
      activeSeconds: [...attention.values()].reduce((a, b) => a + b, 0),
      device: journey.device,
      country: journey.geo.country,
      city: journey.geo.city,
      steps: journey.events.filter(e => ['content_open', 'evidence_open', 'guide_evidence', 'contact_action'].includes(e.action))
        .map(e => ({ at: e.timestamp, action: e.action, content: e.contentId ? label(e.contentId) : null, contact: e.contactKind || null })),
    });
  }
  return items.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
