import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bakery DSS Frontend",
  description: "Frontend Next.js untuk integrasi DSS bakery planning, forecasting, dan model.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        <div className="next-layout-shell">
          <header className="next-topbar">
            <div>
              <div className="next-brand">Bakery DSS</div>
              <div className="next-subtitle">Struktur frontend dibuat seragam agar mudah diintegrasikan dengan project teman Anda.</div>
            </div>
            <nav className="next-nav">
              <Link href="/planning">Planning</Link>
              <Link href="/forecasting/eda">Forecasting EDA</Link>
              <Link href="/forecasting/model">Forecasting Model</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
