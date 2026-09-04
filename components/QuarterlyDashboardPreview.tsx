"use client";

import { QuarterlyDashboard } from "./QuarterlyDashboard";

type QuarterlyDashboardPreviewProps = {
  href: string;
  onOpen?: () => void;
};

export function QuarterlyDashboardPreview({
  href,
  onOpen,
}: QuarterlyDashboardPreviewProps) {
  return (
    <div className="quarterly-dashboard-preview">
      <QuarterlyDashboard embedded />
      <a
        aria-label="Open full dashboard"
        className="quarterly-dashboard-preview-action"
        href={href}
        onClick={onOpen}
      >
        Open full dashboard ↗
      </a>
    </div>
  );
}
