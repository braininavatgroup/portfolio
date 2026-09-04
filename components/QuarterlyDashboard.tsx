"use client";

import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
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

function TrendChart({
  activeLabel,
  onSelect,
  trend,
}: {
  activeLabel: string;
  onSelect: (period: QuarterTrend) => void;
  trend: readonly QuarterTrend[];
}) {
  const width = 1160;
  const height = 268;
  const inset = { bottom: 44, left: 58, right: 58, top: 26 };
  const plotWidth = width - inset.left - inset.right;
  const plotHeight = height - inset.top - inset.bottom;
  const maxPitches = Math.max(50, ...trend.map((period) => period.pitches));
  const x = (index: number) =>
    inset.left + (trend.length === 1 ? plotWidth / 2 : (index / (trend.length - 1)) * plotWidth);
  const countY = (value: number) => inset.top + plotHeight - (value / maxPitches) * plotHeight;
  const rateY = (value: number) => inset.top + plotHeight - (value / 50) * plotHeight;
  const points = (field: "pitches" | "signedExclusives" | "conversionRate") =>
    trend
      .map((period, index) => {
        const value = period[field];
        return `${x(index)},${field === "conversionRate" ? rateY(value) : countY(value)}`;
      })
      .join(" ");

  const activate = (event: KeyboardEvent<SVGGElement>, period: QuarterTrend) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(period);
    }
  };

  return (
    <div className="quarterly-dashboard-chart-scroll">
      <svg
        aria-label="Quarterly pitch, exclusive, and conversion trends"
        className="quarterly-dashboard-chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <g className="quarterly-dashboard-chart-grid">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = inset.top + plotHeight * ratio;
            return <line key={ratio} x1={inset.left} x2={width - inset.right} y1={y} y2={y} />;
          })}
        </g>
        <polyline
          className="quarterly-dashboard-chart-line"
          data-series="pitches"
          points={points("pitches")}
        />
        <polyline
          className="quarterly-dashboard-chart-line"
          data-series="exclusives"
          points={points("signedExclusives")}
        />
        <polyline
          className="quarterly-dashboard-chart-line"
          data-series="conversion"
          points={points("conversionRate")}
        />
        {trend.map((period, index) => {
          const cx = x(index);
          const cy = countY(period.pitches);
          const selected = period.label === activeLabel;
          return (
            <g
              aria-label={`Show ${period.label}`}
              className="quarterly-dashboard-chart-target"
              data-selected={selected}
              key={period.label}
              onClick={() => onSelect(period)}
              onKeyDown={(event) => activate(event, period)}
              role="button"
              tabIndex={0}
            >
              <circle className="quarterly-dashboard-chart-hit" cx={cx} cy={cy} r="18" />
              <circle className="quarterly-dashboard-chart-point" cx={cx} cy={cy} r={selected ? 6 : 4} />
              <title>
                {`${period.label}: ${period.pitches} pitches, ${period.signedExclusives} exclusives, ${formatPercent(period.conversionRate)} conversion`}
              </title>
            </g>
          );
        })}
        <g className="quarterly-dashboard-chart-labels">
          {trend.map((period, index) => (
            <text key={period.label} textAnchor="middle" x={x(index)} y={height - 12}>
              {period.label}
            </text>
          ))}
        </g>
      </svg>
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
        <label className="quarterly-dashboard-filter quarterly-dashboard-filter-stage">
          <span>Stage</span>
          <select
            multiple
            onChange={(event) =>
              onChange({
                ...filters,
                stages: [...event.target.selectedOptions].map(
                  (option) => option.value as PitchStage,
                ),
              })
            }
            value={[...filters.stages]}
          >
            {pitchStages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>
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
      <small>View pitch detail ↗</small>
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
  const visible = filterPitches(allPitches, filters);
  const summary = summarizePitches(visible);
  const losses = filterPitches(allPitches, {
    ...filters,
    lostTo: "all",
    stages: ["Lost"],
  });
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
          <div className="quarterly-dashboard-loss-list">
            {competitorCounts.map(({ competitor, count }) => (
              <button
                aria-label={`Show pitches lost to ${competitor}`}
                className="quarterly-dashboard-loss-row"
                key={competitor}
                onClick={() => onFiltersChange({ ...filters, lostTo: competitor })}
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

function DashboardDetailView({ pitches }: { pitches: readonly Pitch[] }) {
  const sorted = [...pitches].sort((a, b) =>
    (b.determinationDate ?? b.pitchDate).localeCompare(
      a.determinationDate ?? a.pitchDate,
    ),
  );

  return (
    <section className="quarterly-dashboard-detail">
      <div className="quarterly-dashboard-detail-heading">
        <div>
          <p>Drill-down</p>
          <h2>Pitch Detail</h2>
        </div>
        <button onClick={() => downloadCsv(sorted)} type="button">
          Download CSV
        </button>
      </div>
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
                <td>{pitch.property}</td>
                <td>{formatDate(pitch.pitchDate)}</td>
                <td>
                  <span className="quarterly-dashboard-stage" data-stage={pitch.stage}>
                    {pitch.stage}
                  </span>
                </td>
                <td>{formatDate(pitch.determinationDate)}</td>
                <td>{formatMoney(pitch.listedPrice)}</td>
                <td>{formatMoney(pitch.soldPrice)}</td>
                <td>{pitch.lostTo ?? "—"}</td>
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

  return (
    <main className="quarterly-dashboard" id="main-content">
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
            <h1>Ryan + Ryan Quarterly Pitch Conversion</h1>
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
          {filters.lostTo !== "all" ? <span>Lost to {filters.lostTo}</span> : null}
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
          <DashboardDetailView pitches={visiblePitches} />
        )}

        <footer className="quarterly-dashboard-footer">Updated 2 hours ago</footer>
      </div>
    </main>
  );
}
