import { shareMetadata } from "../../../lib/portfolio-sharing";
import type { Metadata } from "next";
import { QuarterlyDashboard } from "../../../components/QuarterlyDashboard";

export const metadata: Metadata = {
  ...shareMetadata("demo-quarterly-dashboard"),
};

export default function DashboardPage() {
  return (
    <QuarterlyDashboard
      returnHref="/?view=graph#real-estate"
      returnLabel="Real-Estate Deal Tracker"
    />
  );
}
