import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CursorInstrument } from "../components/CursorInstrument";
import { PortfolioAnalytics } from "../components/PortfolioAnalytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PortfolioAnalytics />
        <CursorInstrument />
        <div id="app-shell">
          <a className="skip-link" href="#main-content">
            Skip to portfolio content
          </a>
          {children}
        </div>
        <div id="avatar-toybox-root" />
      </body>
    </html>
  );
}
