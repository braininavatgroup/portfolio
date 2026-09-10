import { shareMetadata } from "../../../lib/portfolio-sharing";
import type { Metadata } from "next";
import { TouringDemo } from "../../../components/TouringDemo";

export const metadata: Metadata = {
  ...shareMetadata("demo-touring"),
};

export default function TouringDemoPage() {
  return <TouringDemo />;
}
