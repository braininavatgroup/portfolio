import { shareMetadata } from "../../lib/portfolio-sharing";
import type { Metadata } from "next";
import { DesignGallery } from "./DesignGallery";

export const metadata: Metadata = {
  ...shareMetadata("design"),
};

export default function DesignGalleryPage() {
  return <DesignGallery />;
}
