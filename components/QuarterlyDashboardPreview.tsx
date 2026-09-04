"use client";

import { useMemo } from "react";
import {
  buildQuarterTrend,
  filterPitches,
  generatePitchDataset,
  summarizePitches,
} from "../lib/quarterly-dashboard";

type QuarterlyDashboardPreviewProps = {
  href: string;
  label: string;
  onOpen?: () => void;
};

export function QuarterlyDashboardPreview({
  href,
  label,
  onOpen,
}: QuarterlyDashboardPreviewProps) {
  const { points, summary } = useMemo(() => {
    const pitches = generatePitchDataset();
    const selected = filterPitches(pitches, {
      lostTo: "all",
      quarter: "Q2",
      stages: [],
      year: 2026,
    });
    const trend = buildQuarterTrend(pitches);
    const max = Math.max(...trend.map((period) => period.pitches));
    const chartPoints = trend
      .map((period, index) => {
        const x = 10 + (index / Math.max(1, trend.length - 1)) * 300;
        const y = 66 - (period.pitches / max) * 48;
        return `${x},${y}`;
      })
      .join(" ");
    return { points: chartPoints, summary: summarizePitches(selected) };
  }, []);

  return (
    <a
      aria-label="Explore the dashboard"
      className="quarterly-dashboard-preview"
      href={href}
      onClick={onOpen}
    >
      <span className="quarterly-dashboard-preview-eyebrow">Interactive dashboard</span>
      <span className="quarterly-dashboard-preview-heading">
        <strong>{label}</strong>
        <span>2026 Q2</span>
      </span>
      <span className="quarterly-dashboard-preview-metrics">
        <span>
          <small>Pitches</small>
          <strong>{summary.pitches}</strong>
        </span>
        <span>
          <small>Signed</small>
          <strong>{summary.signedExclusives}</strong>
        </span>
        <span>
          <small>Conversion</small>
          <strong>{summary.conversionRate.toFixed(1)}%</strong>
        </span>
      </span>
      <svg
        aria-label="Eight-quarter pitch trend"
        className="quarterly-dashboard-preview-chart"
        role="img"
        viewBox="0 0 320 76"
      >
        <line x1="10" x2="310" y1="66" y2="66" />
        <polyline points={points} />
      </svg>
      <span className="quarterly-dashboard-preview-action">Explore the dashboard ↗</span>
    </a>
  );
}
