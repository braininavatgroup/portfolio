// Renders the insights history and latest snapshot as one self-contained HTML
// page: no network, no script dependencies, inline SVG. Pure functions so the
// layout can be tested without a browser; `renderDashboard` is the entry.
//
// Chart forms follow the data's job: stat tiles for the headline numbers, a
// line for the believable-humans curve across runs, small-multiple bars for
// the day-by-day trend (three measures of different scale, one axis each),
// and horizontal bars for ranked lists. Colour is assigned per entity in a
// fixed order and never carries text; every figure has a table view.

const PALETTE = {
  light: { series1: "#2a78d6", series2: "#eb6834", series3: "#1baf7a" },
  dark: { series1: "#3987e5", series2: "#d95926", series3: "#199e70" },
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/gu, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

const number = (value) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? "–"
    : Number(value).toLocaleString("en-US");

/** The newest snapshot's headline numbers, each with a one-line meaning. */
export function headlineTiles(snapshot) {
  if (!snapshot) return [];
  const believable = snapshot.believable ?? {};
  const clarity = snapshot.clarity?.error ? null : snapshot.clarity;
  const edge = snapshot.cloudflare?.edge;
  const detail = edge?.detail?.error ? null : edge?.detail;
  const edgeRequests = edge?.daily?.reduce((sum, row) => sum + row.requests, 0) ?? null;
  const linkedin = (clarity?.breakdowns?.sources ?? [])
    .filter((row) => /linkedin/iu.test(row.value))
    .reduce((sum, row) => sum + row.sessions, 0);
  return [
    {
      label: "Believable sessions",
      value: believable.claritySessions,
      note: `Clarity, last ${clarity?.days ?? 3} days, localhost removed`,
    },
    {
      label: "Believable visits",
      value: believable.cloudflareVisits,
      note: "Cloudflare, whole window; undercounts by design",
    },
    { label: "From LinkedIn", value: clarity ? linkedin : null, note: "Clarity sessions" },
    { label: "Edge requests", value: edgeRequests, note: "everything, including crawlers" },
    { label: "Crawler requests", value: detail?.crawlerRequests ?? null, note: "named crawlers" },
    { label: "Server errors", value: detail?.serverErrors ?? null, note: "5xx at the edge" },
  ];
}

function svgLine({ points, width = 720, height = 200, series, id }) {
  const pad = { top: 12, right: 16, bottom: 28, left: 44 };
  const xs = points.map((p) => p.x);
  const ys = series.flatMap((s) => points.map((p) => p[s.key]).filter((v) => v !== null && v !== undefined));
  const maxY = Math.max(1, ...ys);
  const x = (i) => pad.left + (xs.length === 1 ? 0 : (i / (xs.length - 1)) * (width - pad.left - pad.right));
  const y = (v) => pad.top + (1 - v / maxY) * (height - pad.top - pad.bottom);
  const ticks = [0, 0.5, 1].map((t) => Math.round(maxY * t));
  const grid = ticks
    .map(
      (t) =>
        `<line class="grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y(t)}" y2="${y(t)}"/>` +
        `<text class="tick" x="${pad.left - 6}" y="${y(t) + 4}" text-anchor="end">${number(t)}</text>`,
    )
    .join("");
  const paths = series
    .map((s) => {
      const d = points
        .map((p, i) => (p[s.key] === null || p[s.key] === undefined ? null : `${x(i)},${y(p[s.key])}`))
        .filter(Boolean)
        .map((c, i) => `${i === 0 ? "M" : "L"}${c}`)
        .join(" ");
      const last = [...points].reverse().find((p) => p[s.key] !== null && p[s.key] !== undefined);
      const lastIndex = points.lastIndexOf(last);
      // Label the newest point; hang it to the right while the curve is short
      // enough that "end" anchoring would run off the left edge.
      const hangRight = lastIndex < 2 || x(lastIndex) < width / 3;
      const label = last
        ? `<text class="direct" x="${x(lastIndex) + (hangRight ? 10 : -4)}" y="${Math.max(12, y(last[s.key]) - 8)}" text-anchor="${hangRight ? "start" : "end"}">${escapeHtml(s.label)} ${number(last[s.key])}</text>`
        : "";
      const markers = points
        .map((p, i) =>
          p[s.key] === null || p[s.key] === undefined
            ? ""
            : `<circle class="marker" style="--c:var(--${s.color})" cx="${x(i)}" cy="${y(p[s.key])}" r="4"><title>${escapeHtml(p.label)}: ${escapeHtml(s.label)} ${number(p[s.key])}</title></circle>`,
        )
        .join("");
      return `<path class="series" style="--c:var(--${s.color})" d="${d}"/>${markers}${label}`;
    })
    .join("");
  const xLabels = points
    .map((p, i) =>
      i === 0 || i === points.length - 1 || points.length <= 8
        ? `<text class="tick" x="${x(i)}" y="${height - 8}" text-anchor="middle">${escapeHtml(p.label)}</text>`
        : "",
    )
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title">${grid}${paths}${xLabels}</svg>`;
}

function svgBars({ rows, width = 720, color = "series1", id }) {
  const rowHeight = 22;
  const labelWidth = 260;
  const height = rows.length * rowHeight + 8;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const bars = rows
    .map((r, i) => {
      const w = Math.max(2, ((width - labelWidth - 80) * r.value) / max);
      const yPos = 4 + i * rowHeight;
      return (
        `<text class="label" x="${labelWidth - 8}" y="${yPos + 15}" text-anchor="end">${escapeHtml(r.label.length > 44 ? `${r.label.slice(0, 43)}…` : r.label)}</text>` +
        `<rect class="bar" style="--c:var(--${color})" x="${labelWidth}" y="${yPos + 3}" width="${w}" height="${rowHeight - 6}" rx="3"><title>${escapeHtml(r.label)}: ${number(r.value)}</title></rect>` +
        `<text class="direct" x="${labelWidth + w + 6}" y="${yPos + 15}">${number(r.value)}</text>`
      );
    })
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title">${bars}</svg>`;
}

function svgColumns({ rows, width = 360, height = 130, color = "series1", id }) {
  const pad = { top: 18, bottom: 22, left: 6, right: 6 };
  const max = Math.max(1, ...rows.map((r) => r.value));
  const gap = 2;
  const slot = (width - pad.left - pad.right) / Math.max(1, rows.length);
  const columns = rows
    .map((r, i) => {
      const h = ((height - pad.top - pad.bottom) * r.value) / max;
      const xPos = pad.left + i * slot + gap / 2;
      const yPos = height - pad.bottom - h;
      return (
        `<rect class="bar" style="--c:var(--${color})" x="${xPos}" y="${yPos}" width="${slot - gap}" height="${h}" rx="3"><title>${escapeHtml(r.label)}: ${number(r.value)}</title></rect>` +
        `<text class="direct" x="${xPos + (slot - gap) / 2}" y="${yPos - 4}" text-anchor="middle">${number(r.value)}</text>` +
        (i === 0 || i === rows.length - 1 || rows.length <= 5
          ? `<text class="tick" x="${xPos + (slot - gap) / 2}" y="${height - 6}" text-anchor="middle">${escapeHtml(r.label.slice(5))}</text>`
          : "")
      );
    })
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title">${columns}</svg>`;
}

function table(columns, rows) {
  const head = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((cell, i) => `<td class="${i === 0 ? "" : "num"}">${escapeHtml(typeof cell === "number" ? number(cell) : cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<details><summary>Table</summary><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></details>`;
}

function figure({ id, title, note, chart, tableHtml }) {
  return (
    `<figure class="fig"><figcaption><h2 id="${id}-title">${escapeHtml(title)}</h2>` +
    (note ? `<p class="note">${escapeHtml(note)}</p>` : "") +
    `</figcaption>${chart}${tableHtml}</figure>`
  );
}

/**
 * History rows reduced to what the curve needs, oldest first, one per day.
 * @param {Array<Record<string, any>>} rows
 */
export function historySeries(rows = []) {
  const byDay = new Map();
  for (const row of rows) {
    if (!row?.capturedAt) continue;
    byDay.set(String(row.capturedAt).slice(0, 10), row); // the last run of a day wins
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, row]) => ({
      x: day,
      label: day.slice(5),
      believableSessions: row.believableSessions ?? null,
      believableVisits: row.believableVisits ?? null,
      edgeRequests: row.edgeRequests ?? null,
    }));
}

/**
 * @param {{ snapshot: Record<string, any> | null, history?: Array<Record<string, any>>, generatedAt?: string }} input
 */
export function renderDashboard({ snapshot, history = [], generatedAt = new Date().toISOString() }) {
  const tiles = headlineTiles(snapshot);
  const curve = historySeries(history);
  const cf = snapshot?.cloudflare?.error ? null : snapshot?.cloudflare;
  const clarity = snapshot?.clarity?.error ? null : snapshot?.clarity;
  const detail = cf?.edge?.detail?.error ? null : cf?.edge?.detail;
  const windowLabel = snapshot?.window
    ? `${snapshot.window.start.slice(0, 10)} → ${snapshot.window.end.slice(0, 10)}`
    : "no snapshot yet";

  const sections = [];

  sections.push(
    `<section class="tiles">${tiles
      .map(
        (t) =>
          `<div class="tile"><div class="tile-label">${escapeHtml(t.label)}</div><div class="tile-value">${number(t.value)}</div><div class="note">${escapeHtml(t.note)}</div></div>`,
      )
      .join("")}</section>`,
  );

  if (curve.length > 0) {
    const series = [
      { key: "believableSessions", label: "Clarity sessions", color: "series1" },
      { key: "believableVisits", label: "Cloudflare visits", color: "series2" },
    ];
    sections.push(
      figure({
        id: "curve",
        title: "Believable humans, by run",
        note: "Each point is what that day's run saw over its own window (Clarity 3 days, Cloudflare 7). The direction matters more than the level.",
        chart:
          `<div class="legend">${series.map((s) => `<span><i style="--c:var(--${s.color})"></i>${escapeHtml(s.label)}</span>`).join("")}</div>` +
          svgLine({ points: curve, series, id: "curve" }),
        tableHtml: table(
          ["Day", "Clarity sessions", "Cloudflare visits", "Edge requests"],
          curve.map((p) => [p.x, p.believableSessions ?? "–", p.believableVisits ?? "–", p.edgeRequests ?? "–"]),
        ),
      }),
    );
  }

  if (cf?.daily?.length) {
    const edgeByDate = new Map((cf.edge?.daily ?? []).map((r) => [r.date, r.requests]));
    const multiples = [
      { key: "visits", title: "Visits per day", rows: cf.daily.map((r) => ({ label: r.date, value: r.visits })), color: "series2" },
      { key: "pageloads", title: "Pageload beacons per day", rows: cf.daily.map((r) => ({ label: r.date, value: r.pageloads })), color: "series1" },
      { key: "edge", title: "Edge requests per day", rows: cf.daily.map((r) => ({ label: r.date, value: edgeByDate.get(r.date) ?? 0 })), color: "series3" },
    ];
    sections.push(
      `<div class="multiples">${multiples
        .map((m) =>
          figure({
            id: `daily-${m.key}`,
            title: m.title,
            chart: svgColumns({ rows: m.rows, id: `daily-${m.key}`, color: m.color }),
            tableHtml: table(["Day", m.title], m.rows.map((r) => [r.label, r.value])),
          }),
        )
        .join("")}</div>`,
    );
  }

  const ranked = [];
  if (clarity?.breakdowns?.sources?.length) {
    ranked.push({ id: "sources", title: "Where sessions come from", note: "Clarity, session entry source and channel", rows: clarity.breakdowns.sources.slice(0, 10).map((r) => ({ label: r.value, value: r.sessions })), color: "series1", unit: "Sessions" });
  }
  if (clarity?.breakdowns?.pages?.length) {
    ranked.push({ id: "pages", title: "What gets read", note: "Clarity sessions per page, tracking parameters stripped", rows: clarity.breakdowns.pages.slice(0, 12).map((r) => ({ label: r.value, value: r.sessions })), color: "series1", unit: "Sessions" });
  }
  if (detail?.crawlers?.length) {
    ranked.push({ id: "crawlers", title: "Who is crawling", note: "Edge requests by named crawler. Access, not citation.", rows: detail.crawlers.slice(0, 12).map((r) => ({ label: r.value, value: r.requests })), color: "series3", unit: "Requests" });
  }
  if (cf?.shape?.externalReferrers?.length) {
    ranked.push({ id: "referrers", title: "External referrers", note: "Cloudflare visits by referring site; sampled, undercounts", rows: cf.shape.externalReferrers.slice(0, 10).map((r) => ({ label: r.value, value: r.visits })), color: "series2", unit: "Visits" });
  }
  for (const r of ranked) {
    sections.push(
      figure({
        id: r.id,
        title: r.title,
        note: r.note,
        chart: svgBars({ rows: r.rows, id: r.id, color: r.color }),
        tableHtml: table(["Item", r.unit], r.rows.map((row) => [row.label, row.value])),
      }),
    );
  }

  const perf = cf?.performance;
  if (perf?.samples) {
    const rows = [
      ["all", perf.samples, perf.firstContentfulPaint.p75, perf.pageLoadTime.p75, perf.pageLoadTime.p95],
      ...(cf.performanceByDevice ?? []).map((d) => [d.device, d.samples, d.firstContentfulPaint.p75, d.pageLoadTime.p75, d.pageLoadTime.p95]),
    ];
    sections.push(
      figure({
        id: "vitals",
        title: "Web vitals (ms)",
        note: "Cloudflare RUM. p75 is what most visitors get; p95 is the slow tail.",
        chart: "",
        tableHtml: table(["Device", "Samples", "FCP p75", "Load p75", "Load p95"], rows).replace("<details>", "<details open>"),
      }),
    );
  }

  if (clarity?.frustration?.length) {
    sections.push(
      figure({
        id: "frustration",
        title: "Frustration signals",
        note: `Clarity, last ${clarity.days} days: count and share of sessions with at least one`,
        chart: "",
        tableHtml: table(
          ["Signal", "Count", "Sessions"],
          clarity.frustration.map((f) => [f.label, f.value, `${((f.sessionShare ?? 0) * 100).toFixed(1)}%`]),
        ).replace("<details>", "<details open>"),
      }),
    );
  }

  const notes = [];
  if (snapshot?.cloudflare?.error) notes.push(`Cloudflare: ${snapshot.cloudflare.error}`);
  if (snapshot?.clarity?.error) notes.push(`Clarity: ${snapshot.clarity.error}`);
  if (cf?.edge?.error) notes.push(`Edge: ${cf.edge.error}`);
  if (snapshot?.insights?.error) notes.push(`First-party signals: ${snapshot.insights.error}`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Portfolio insights · ${escapeHtml(windowLabel)}</title>
<style>
:root { color-scheme: light dark;
  --surface-1: #fcfcfb; --surface-2: #f2f1ee; --text-primary: #0b0b0b; --text-secondary: #52514e; --grid: #e2e1dc;
  --series1: ${PALETTE.light.series1}; --series2: ${PALETTE.light.series2}; --series3: ${PALETTE.light.series3}; }
@media (prefers-color-scheme: dark) { :root {
  --surface-1: #1a1a19; --surface-2: #242423; --text-primary: #ffffff; --text-secondary: #c3c2b7; --grid: #34342f;
  --series1: ${PALETTE.dark.series1}; --series2: ${PALETTE.dark.series2}; --series3: ${PALETTE.dark.series3}; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; background: var(--surface-1); color: var(--text-primary);
  font: 14px/1.45 -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; max-width: 1080px; margin-inline: auto; }
header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
h1 { font-size: 20px; margin: 0; } h2 { font-size: 15px; margin: 0 0 2px; }
.note, .tile-label, .tick, .legend { color: var(--text-secondary); font-size: 12px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 24px; }
.tile { background: var(--surface-2); border-radius: 8px; padding: 12px 14px; }
.tile-value { font-size: 28px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; margin: 2px 0; }
.fig { margin: 0 0 28px; background: var(--surface-2); border-radius: 8px; padding: 14px 16px; }
.multiples { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.chart { width: 100%; height: auto; display: block; margin-top: 8px; }
.grid { stroke: var(--grid); stroke-width: 1; }
.tick { fill: var(--text-secondary); font-size: 11px; }
.label { fill: var(--text-primary); font-size: 12px; }
.direct { fill: var(--text-primary); font-size: 11px; font-variant-numeric: tabular-nums; }
.series { fill: none; stroke: var(--c); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.marker { fill: var(--c); stroke: var(--surface-2); stroke-width: 2; }
.bar { fill: var(--c); } .bar:hover, .marker:hover { opacity: .8; }
.legend { display: flex; gap: 14px; margin-top: 6px; } .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: var(--c); margin-right: 5px; vertical-align: -1px; }
details { margin-top: 8px; } summary { cursor: pointer; color: var(--text-secondary); font-size: 12px; }
table { border-collapse: collapse; width: 100%; margin-top: 6px; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--grid); font-size: 12px; } th { color: var(--text-secondary); font-weight: 500; }
td.num, th:not(:first-child) { text-align: right; }
.errors { color: var(--text-secondary); font-size: 12px; }
</style>
</head>
<body>
<header><h1>Portfolio insights</h1><span class="note">${escapeHtml(windowLabel)} · generated ${escapeHtml(generatedAt.slice(0, 16).replace("T", " "))} UTC</span></header>
${sections.join("\n")}
${notes.length ? `<p class="errors">${notes.map(escapeHtml).join("<br>")}</p>` : ""}
<p class="note">Believable = Bradley's enrolled browsers, reviewers, localhost and headless runs removed. Cloudflare and Clarity count differently and are never added. Regenerated by every <code>npm run insights</code> run.</p>
</body>
</html>
`;
}
