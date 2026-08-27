import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CursorInstrument } from "../components/CursorInstrument";
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
  title: "Bradley Berkman | Judgment at the center",
  description: "A spatial portfolio of judgment, systems, and artifacts.",
  icons: { icon: "/biv-brain-symbol.png" },
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
