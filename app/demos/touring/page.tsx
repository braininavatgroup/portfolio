import type { Metadata } from "next";
import { TouringDemo } from "../../../components/TouringDemo";

export const metadata: Metadata = {
  title: "Tour advancing demo | Bradley Berkman",
  description: "Follow one show from outstanding details to a completed advance and artist day sheet.",
};

export default function TouringDemoPage() {
  return <TouringDemo />;
}
