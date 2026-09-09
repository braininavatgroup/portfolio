import type { Metadata, Viewport } from "next";
import { CursorInstrument } from "../components/CursorInstrument";
import { PortfolioAnalytics } from "../components/PortfolioAnalytics";
import { portfolioInterfaceText } from "../lib/portfolio-world";
import "./globals.css";

export const metadata: Metadata = {
  title: `Bradley Berkman | ${portfolioInterfaceText["index.throughline"].replace(/\.$/, "")}`,
  description: "The systems, operations, and products Bradley Berkman builds and runs.",
  icons: { icon: "/biv-brain-symbol.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  // The mobile tab bar paints into the home-indicator safe area.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PortfolioAnalytics />
        <CursorInstrument />
        <div id="app-shell">
          <a className="skip-link" href="#main-content">
            {portfolioInterfaceText["layout.skipLink"]}
          </a>
          {children}
        </div>
      </body>
    </html>
  );
}
