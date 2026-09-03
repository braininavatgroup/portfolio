import type { Metadata, Viewport } from "next";
import { CursorInstrument } from "../components/CursorInstrument";
import { PortfolioAnalytics } from "../components/PortfolioAnalytics";
import { ContentEditorProvider } from "../components/editor/ContentEditorProvider";
import { EditableText } from "../components/editor/EditableText";
import { portfolioInterfaceText } from "../lib/portfolio-world";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bradley Berkman | Make complexity legible enough to act on",
  description: "The systems, operations, and products Bradley Berkman builds and runs.",
  icons: { icon: "/biv-brain-symbol.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
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
        <ContentEditorProvider>
          <div id="app-shell">
            <EditableText
              as="a"
              className="skip-link"
              href="#main-content"
              path="interface.layout.skipLink"
              value={portfolioInterfaceText["layout.skipLink"]}
            />
            {children}
          </div>
        </ContentEditorProvider>
      </body>
    </html>
  );
}
