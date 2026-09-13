import type { Metadata } from "next";
import { portfolioInterfaceText, portfolioThreads, portfolioWorldNodes } from "./portfolio-world";
import { stripInlineLinks } from "./portfolio-inline-links";

export const portfolioOrigin = "https://bradleyberkman.com";

export type SharePage = {
  id: string;
  path: string;
  title: string;
  description: string;
  kind: string;
};

// One inventory drives page metadata and the build-time PNG cards. New records
// and themes inherit previews automatically from the authored content.
export const sharePages: readonly SharePage[] = [
  { id: "home", path: "/", title: `Bradley Berkman | ${portfolioInterfaceText["index.throughline"].replace(/\.$/, "")}`, description: "The systems, operations, and products Bradley Berkman builds and runs.", kind: "Portfolio" },
  ...portfolioWorldNodes.map((node) => {
    const thread = portfolioThreads.find((item) => item.nodeId === node.id);
    return { id: node.id, path: `/index/${node.id}`, title: thread?.title ?? node.label, description: stripInlineLinks(thread?.lede ?? node.summary), kind: node.kind };
  }),
  { id: "privacy", path: "/privacy", title: "Privacy", description: "How this portfolio handles analytics, privacy preferences, and messages sent to the Guide.", kind: "Portfolio" },
  { id: "design", path: "/design", title: "Design gallery", description: "Every design token and portfolio component in its meaningful states, in light and dark.", kind: "Design system" },
  { id: "demo-touring", path: "/demos/touring", title: "Tour advancing demo", description: "Follow one show from outstanding details to a completed advance and artist day sheet.", kind: "Interactive demo" },
  { id: "demo-quarterly-dashboard", path: "/demos/quarterly-dashboard", title: "Quarterly pitch conversion", description: "An interactive quarterly pitch-conversion dashboard for a real-estate operations workflow.", kind: "Interactive demo" },
];

export function shareMetadata(id: string): Metadata {
  const page = sharePages.find((item) => item.id === id);
  if (!page) throw new Error(`Unknown share page: ${id}`);
  const title = id === "home" ? page.title : `${page.title} | Bradley Berkman`;
  const url = `${portfolioOrigin}${page.path}`;
  const image = `${portfolioOrigin}/sharing/${page.id}.png?v=biv-433`;
  return {
    metadataBase: new URL(portfolioOrigin),
    title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website", siteName: "Bradley Berkman", locale: "en_US",
      title, description: page.description, url,
      images: [{ url: image, width: 1200, height: 630, type: "image/png", alt: `${page.title} — ${page.description}` }],
    },
    twitter: { card: "summary_large_image", title, description: page.description, images: [{ url: image, alt: `${page.title} — ${page.description}` }] },
  };
}
