import type { Metadata } from "next";
import { DesignGallery } from "./DesignGallery";

export const metadata: Metadata = {
  title: "Design gallery | Bradley Berkman",
  description:
    "Every design token and every portfolio component in its meaningful states, in light and dark.",
};

export default function DesignGalleryPage() {
  return <DesignGallery />;
}
