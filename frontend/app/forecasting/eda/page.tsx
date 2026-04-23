import Link from "next/link";

export default function ForecastingEdaPage() {
  return (
    <main className="app-shell">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Forecasting EDA</h2>
            <p className="panel-subtitle">Halaman ini disiapkan agar format frontend sama dengan project teman Anda.</p>
          </div>
          <span className="badge">Placeholder</span>
        </div>
        <div className="stack-list">
          <div className="metric-pill">
            Status: <strong>Siap untuk integrasi</strong>
          </div>
          <div className="inline-note">
            Bagian ini bisa dipakai nanti untuk exploratory data analysis, visualisasi demand, atau statistik pendukung forecast.
          </div>
        </div>
        <div className="footer-strip">
          <Link href="/planning" className="chip-button is-active">
            Buka Planning
          </Link>
          <Link href="/forecasting/model" className="chip-button">
            Ke Model
          </Link>
        </div>
      </section>
    </main>
  );
}
