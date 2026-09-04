import type { Metadata } from "next";
import { QuarterlyDashboard } from "../../../components/QuarterlyDashboard";

export const metadata: Metadata = {
  description:
    "An interactive quarterly pitch-conversion dashboard for a real-estate operations workflow.",
  title: "Quarterly pitch conversion | Bradley Berkman",
};

export default function DashboardPage() {
  return (
    <QuarterlyDashboard
      returnHref="/?view=graph#real-estate"
      returnLabel="Back to Real-estate deal tracker"
    />
  );
}
