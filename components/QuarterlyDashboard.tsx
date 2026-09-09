"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  buildQuarterTrend,
  filterPitches,
  generatePitchDataset,
  pitchCompetitors,
  pitchesToCsv,
  pitchStages,
  summarizePitches,
  type DashboardFilters,
  type Pitch,
  type PitchStage,
  type Quarter,
  type QuarterTrend,
} from "../lib/quarterly-dashboard";

type DashboardView = "summary" | "detail";

type QuarterlyDashboardProps = {
  embedded?: boolean;
  returnHref?: string;
  returnLabel?: string;
};

const years = [2024, 2025, 2026] as const;
const quarters = ["Q1", "Q2", "Q3", "Q4"] as const;

function formatMoney(value?: number) {
  if (!value) return "—";
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function periodFromLabel(label: string) {
  const [year, quarter] = label.split(" ");
  return { quarter: quarter as Quarter, year: Number(year) };
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function downloadCsv(pitches: readonly Pitch[]) {
  const blob = new Blob([pitchesToCsv(pitches)], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = "quarterly-pitch-detail.csv";
  link.href = href;
  link.click();
  URL.revokeObjectURL(href);
}

// Round an axis up to a whole number of readable steps, so every gridline
// lands on a value worth printing.
function niceAxisMax(value: number, divisions: number) {
  if (value <= 0) return divisions;
  const magnitude = 10 ** Math.floor(Math.log10(value / divisions));
  const step =
    [1, 2, 2.5, 5, 10]
      .map((multiple) => multiple * magnitude)
      .find((candidate) => candidate * divisions >= value) ?? 10 * magnitude;
  return step * divisions;
}

function TrendChart({
  activeLabel,
  onSelect,
  trend,
}: {
  activeLabel: string;
  onSelect: (period: QuarterTrend) => void;
  trend: readonly QuarterTrend[];
}) {
  // The plot is drawn in a stretched 0-100 space so it fills whatever box CSS
  // gives it. Nothing that has to keep its shape lives in that space: strokes
  // opt out of scaling, and the points, axes, and labels are HTML positioned by
  // the same percentages, so text stays at its real size at every width.
  const divisions = 5;
  const countMax = niceAxisMax(Math.max(...trend.map((period) => period.pitches), 0), divisions);
  const rateMax = niceAxisMax(
    Math.max(...trend.map((period) => period.conversionRate), 0),
    divisions,
  );
  const ticks = Array.from({ length: divisions + 1 }, (_, index) => index / divisions);
  const x = (index: number) =>
    trend.length === 1 ? 50 : (index / (trend.length - 1)) * 100;
  const countY = (value: number) => 100 - (value / countMax) * 100;
  const rateY = (value: number) => 100 - (value / rateMax) * 100;
  const points = (field: "pitches" | "signedExclusives" | "conversionRate") =>
    trend
      .map((period, index) => {
        const value = period[field];
        return `${x(index)},${field === "conversionRate" ? rateY(value) : countY(value)}`;
      })
      .join(" ");

  return (
    <div className="quarterly-dashboard-chart">
      <div aria-hidden="true" className="quarterly-dashboard-chart-axis" data-axis="count">
        {ticks.map((ratio) => (
          <span key={ratio} style={{ top: `${(1 - ratio) * 100}%` }}>
            {Math.round(ratio * countMax)}
          </span>
        ))}
      </div>
      <div className="quarterly-dashboard-chart-plot">
        <svg
          aria-label={`Quarterly trends. Pitches and signed exclusives are counts up to ${countMax} on the left; conversion rate is a percentage up to ${rateMax} on the right.`}
          className="quarterly-dashboard-chart-lines"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 100"
        >
          <g className="quarterly-dashboard-chart-grid">
            {ticks.map((ratio) => (
              <line
                key={ratio}
                vectorEffect="non-scaling-stroke"
                x1="0"
                x2="100"
                y1={(1 - ratio) * 100}
                y2={(1 - ratio) * 100}
              />
            ))}
          </g>
          {(
            [
              ["pitches", "pitches"],
              ["exclusives", "signedExclusives"],
              ["conversion", "conversionRate"],
            ] as const
          ).map(([series, field]) => (
            <polyline
              className="quarterly-dashboard-chart-line"
              data-series={series}
              key={series}
              points={points(field)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {trend.map((period, index) => (
          <button
            aria-label={`Show ${period.label}`}
            className="quarterly-dashboard-chart-point"
            data-selected={period.label === activeLabel}
            key={period.label}
            onClick={() => onSelect(period)}
            style={{
              left: `${x(index)}%`,
              top: `${countY(period.pitches)}%`,
            }}
            title={`${period.label}: ${period.pitches} pitches, ${period.signedExclusives} exclusives, ${formatPercent(period.conversionRate)} conversion`}
            type="button"
          />
        ))}
      </div>
      <div aria-hidden="true" className="quarterly-dashboard-chart-axis" data-axis="rate">
        {ticks.map((ratio) => (
          <span key={ratio} style={{ top: `${(1 - ratio) * 100}%` }}>
            {`${Math.round(ratio * rateMax)}%`}
          </span>
        ))}
      </div>
      <div className="quarterly-dashboard-chart-labels">
        {trend.map((period, index) => (
          <span key={period.label} style={{ left: `${x(index)}%` }}>
            {period.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function FilterBar({
  filters,
  onChange,
  showStages,
}: {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  showStages: boolean;
}) {
  return (
    <div className="quarterly-dashboard-filters">
      <label className="quarterly-dashboard-filter">
        <span>Year</span>
        <select
          onChange={(event) =>
            onChange({
              ...filters,
              year: event.target.value === "all" ? "all" : Number(event.target.value),
            })
          }
          value={filters.year}
        >
          <option value="all">All years</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <label className="quarterly-dashboard-filter">
        <span>Quarter</span>
        <select
          onChange={(event) =>
            onChange({ ...filters, quarter: event.target.value as Quarter | "all" })
          }
          value={filters.quarter}
        >
          <option value="all">All quarters</option>
          {quarters.map((quarter) => (
            <option key={quarter} value={quarter}>
              {quarter}
            </option>
          ))}
        </select>
      </label>
      {showStages ? (
        <div className="quarterly-dashboard-filter quarterly-dashboard-filter-stage">
          <span id="quarterly-dashboard-stage-label">Stage</span>
          <div
            aria-labelledby="quarterly-dashboard-stage-label"
            className="quarterly-dashboard-chips"
            role="group"
          >
            {pitchStages.map((stage) => {
              const selected = filters.stages.includes(stage);
              return (
                <button
                  aria-pressed={selected}
                  key={stage}
                  onClick={() =>
                    onChange({
                      ...filters,
                      stages: selected
                        ? filters.stages.filter((value) => value !== stage)
                        : [...filters.stages, stage],
                    })
                  }
                  type="button"
                >
                  {stage}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <label className="quarterly-dashboard-filter quarterly-dashboard-filter-competitor">
        <span>Lost to</span>
        <select
          onChange={(event) => onChange({ ...filters, lostTo: event.target.value })}
          value={filters.lostTo}
        >
          <option value="all">All competitors</option>
          {pitchCompetitors.map((competitor) => (
            <option key={competitor} value={competitor}>
              {competitor}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function SummaryCard({
  label,
  onClick,
  value,
}: {
  label: string;
  onClick: () => void;
  value: string | number;
}) {
  return (
    <button className="quarterly-dashboard-scorecard" onClick={onClick} type="button">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>View pitch detail ↗︎</small>
    </button>
  );
}

function DashboardSummaryView({
  activeLabel,
  allPitches,
  filters,
  onFiltersChange,
  onOpenDetail,
  trend,
}: {
  activeLabel: string;
  allPitches: readonly Pitch[];
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  onOpenDetail: (stages: readonly PitchStage[]) => void;
  trend: readonly QuarterTrend[];
}) {
  const periodFilters = { ...filters, lostTo: "all" };
  const summary = summarizePitches(filterPitches(allPitches, periodFilters));
  const losses = filterPitches(allPitches, { ...periodFilters, stages: ["Lost"] });
  const competitorCounts = pitchCompetitors.map((competitor) => ({
    competitor,
    count: losses.filter((pitch) => pitch.lostTo === competitor).length,
  }));
  const maxLosses = Math.max(1, ...competitorCounts.map(({ count }) => count));

  return (
    <>
      <div className="quarterly-dashboard-scorecards">
        <SummaryCard
          label="Pitches this quarter"
          onClick={() => onOpenDetail([])}
          value={summary.pitches}
        />
        <SummaryCard
          label="Signed exclusives"
          onClick={() => onOpenDetail(["Signed exclusive"])}
          value={summary.signedExclusives}
        />
        <SummaryCard
          label="Conversion rate"
          onClick={() => onOpenDetail(["Signed exclusive", "Lost", "Passed"])}
          value={formatPercent(summary.conversionRate)}
        />
      </div>

      <section className="quarterly-dashboard-panel quarterly-dashboard-trend-panel">
        <h2>Trend over time</h2>
        <TrendChart
          activeLabel={activeLabel}
          onSelect={(period) => {
            const selected = periodFromLabel(period.label);
            onFiltersChange({ ...filters, ...selected });
          }}
          trend={trend}
        />
        <div className="quarterly-dashboard-legend" aria-label="Chart legend">
          <span data-series="pitches">Pitches</span>
          <span data-series="exclusives">Signed exclusives</span>
          <span data-series="conversion">Conversion rate</span>
        </div>
      </section>

      <div className="quarterly-dashboard-support-grid">
        <div className="quarterly-dashboard-support-cards">
          <button
            className="quarterly-dashboard-support-card"
            onClick={() => onOpenDetail(["Open"])}
            type="button"
          >
            <span>Open pitches right now</span>
            <strong>{summary.openPitches}</strong>
            <small>Pitches still in flight</small>
          </button>
          <button
            className="quarterly-dashboard-support-card"
            onClick={() => onOpenDetail(["Signed exclusive"])}
            type="button"
          >
            <span>New listings this quarter</span>
            <strong>{summary.newListings}</strong>
            <small>Listings won in the selected period</small>
          </button>
        </div>
        <section className="quarterly-dashboard-panel quarterly-dashboard-losses">
          <h2>Where deals went</h2>
          <p className="quarterly-dashboard-panel-note">
            Every loss in the period. Choosing one scopes the pitch detail.
          </p>
          <div className="quarterly-dashboard-loss-list">
            {competitorCounts.map(({ competitor, count }) => (
              <button
                aria-label={`Show pitches lost to ${competitor}`}
                aria-pressed={filters.lostTo === competitor}
                className="quarterly-dashboard-loss-row"
                key={competitor}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    lostTo: filters.lostTo === competitor ? "all" : competitor,
                  })
                }
                style={{ "--bar-width": `${(count / maxLosses) * 100}%` } as CSSProperties}
                type="button"
              >
                <span>{competitor}</span>
                <span className="quarterly-dashboard-loss-track">
                  <span className="quarterly-dashboard-loss-fill" />
                </span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <td data-empty={value === "—"} data-label={label}>
      {value}
    </td>
  );
}

function DashboardDetailView({
  onBack,
  periodLabel,
  pitches,
  stages,
}: {
  onBack: () => void;
  periodLabel: string;
  pitches: readonly Pitch[];
  stages: readonly PitchStage[];
}) {
  const sorted = [...pitches].sort((a, b) =>
    (b.determinationDate ?? b.pitchDate).localeCompare(
      a.determinationDate ?? a.pitchDate,
    ),
  );
  const summary = summarizePitches(sorted);
  const scope = stages.length === 0 ? "All stages" : stages.join(", ");

  return (
    <section className="quarterly-dashboard-detail">
      <div className="quarterly-dashboard-detail-heading">
        <div>
          <p>Drill-down</p>
          <h2>Pitch Detail</h2>
          <p className="quarterly-dashboard-detail-scope">
            {`${periodLabel} · ${scope} · ${sorted.length} ${sorted.length === 1 ? "pitch" : "pitches"}`}
          </p>
        </div>
        <div className="quarterly-dashboard-detail-actions">
          <button onClick={onBack} type="button">
            ← Summary
          </button>
          <button onClick={() => downloadCsv(sorted)} type="button">
            Download CSV
          </button>
        </div>
      </div>
      <dl className="quarterly-dashboard-detail-stats">
        <div>
          <dt>Signed</dt>
          <dd>{summary.signedExclusives}</dd>
        </div>
        <div>
          <dt>Open</dt>
          <dd>{summary.openPitches}</dd>
        </div>
        <div>
          <dt>Conversion</dt>
          <dd>{formatPercent(summary.conversionRate)}</dd>
        </div>
      </dl>
      <div className="quarterly-dashboard-table-scroll">
        <table>
          <caption className="sr-only">Pitch detail rows</caption>
          <thead>
            <tr>
              <th scope="col">Property</th>
              <th scope="col">Pitched</th>
              <th scope="col">Stage</th>
              <th scope="col">Resolved</th>
              <th scope="col">Listed</th>
              <th scope="col">Sold</th>
              <th scope="col">Lost to</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((pitch) => (
              <tr key={pitch.id}>
                <td data-label="Property">{pitch.property}</td>
                <td data-label="Pitched">{formatDate(pitch.pitchDate)}</td>
                <td data-label="Stage">
                  <span className="quarterly-dashboard-stage" data-stage={pitch.stage}>
                    {pitch.stage}
                  </span>
                </td>
                <Cell label="Resolved" value={formatDate(pitch.determinationDate)} />
                <Cell label="Listed" value={formatMoney(pitch.listedPrice)} />
                <Cell label="Sold" value={formatMoney(pitch.soldPrice)} />
                <Cell label="Lost to" value={pitch.lostTo ?? "—"} />
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 ? (
          <p className="quarterly-dashboard-empty">No pitches match the current filters.</p>
        ) : null}
      </div>
      <p className="quarterly-dashboard-row-count" aria-live="polite">
        Showing {sorted.length} {sorted.length === 1 ? "pitch" : "pitches"}
      </p>
    </section>
  );
}

export function QuarterlyDashboard({
  embedded = false,
  returnHref,
  returnLabel,
}: QuarterlyDashboardProps = {}) {
  const allPitches = useMemo(() => generatePitchDataset(), []);
  const [view, setView] = useState<DashboardView>("summary");
  const [filters, setFilters] = useState<DashboardFilters>({
    lostTo: "all",
    quarter: "Q2",
    stages: [],
    year: 2026,
  });
  const visiblePitches = useMemo(
    () => filterPitches(allPitches, filters),
    [allPitches, filters],
  );
  const trendPitches = useMemo(
    () =>
      filterPitches(allPitches, {
        ...filters,
        lostTo: "all",
        quarter: "all",
        year: "all",
      }),
    [allPitches, filters],
  );
  const trend = useMemo(() => buildQuarterTrend(trendPitches), [trendPitches]);
  const activeLabel =
    filters.year === "all" || filters.quarter === "all"
      ? ""
      : `${filters.year} ${filters.quarter}`;
  const periodLabel = [
    filters.year === "all" ? "All years" : filters.year,
    filters.quarter === "all" ? "All quarters" : filters.quarter,
  ].join(" · ");

  const openDetail = (stages: readonly PitchStage[]) => {
    setFilters((current) => ({ ...current, stages }));
    setView("detail");
  };
  const DashboardHeading = embedded ? "h2" : "h1";
  const DashboardRoot = embedded ? "section" : "main";

  return (
    <DashboardRoot
      aria-label={embedded ? "Quarterly pitch conversion dashboard" : undefined}
      className="quarterly-dashboard"
      data-embedded={embedded}
      id={embedded ? undefined : "main-content"}
    >
      <div className="quarterly-dashboard-shell">
        {returnHref && returnLabel ? (
          <nav aria-label="Portfolio return" className="quarterly-dashboard-return">
            <a href={returnHref}>
              <span aria-hidden="true">←</span>
              {returnLabel}
            </a>
            <span>Bradley Berkman</span>
          </nav>
        ) : null}
        <nav aria-label="Dashboard pages" className="quarterly-dashboard-tabs">
          <button
            data-selected={view === "summary"}
            onClick={() => setView("summary")}
            type="button"
          >
            Quarterly Summary
          </button>
          <button
            data-selected={view === "detail"}
            onClick={() => setView("detail")}
            type="button"
          >
            Pitch Detail
          </button>
        </nav>

        <header className="quarterly-dashboard-header">
          <div>
            <p>Quarterly review</p>
            <DashboardHeading>Brokerage Pitch Conversion</DashboardHeading>
          </div>
          <div className="quarterly-dashboard-actions">
            <button onClick={() => window.print()} type="button">
              Print or save as PDF
            </button>
          </div>
        </header>

        <FilterBar filters={filters} onChange={setFilters} showStages={view === "detail"} />

        <div className="quarterly-dashboard-period">
          <span>{periodLabel}</span>
          {view === "detail" && filters.lostTo !== "all" ? (
            <span>Lost to {filters.lostTo}</span>
          ) : null}
        </div>

        {view === "summary" ? (
          <DashboardSummaryView
            activeLabel={activeLabel}
            allPitches={allPitches}
            filters={filters}
            onFiltersChange={setFilters}
            onOpenDetail={openDetail}
            trend={trend}
          />
        ) : (
          <DashboardDetailView
            onBack={() => setView("summary")}
            periodLabel={periodLabel}
            pitches={visiblePitches}
            stages={filters.stages}
          />
        )}

        <footer className="quarterly-dashboard-footer">
          Residential brokerage work sample · synthetic data standing in for the team&rsquo;s
          own sheets
        </footer>
      </div>
    </DashboardRoot>
  );
}
