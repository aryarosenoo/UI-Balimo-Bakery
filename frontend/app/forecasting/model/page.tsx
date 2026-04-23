import Link from "next/link";

export default function ForecastingModelPage() {
  return (
    <main className="app-shell">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Forecasting Model</h2>
            <p className="panel-subtitle">Struktur route ini mengikuti pola frontend teman Anda agar proses merge lebih mudah.</p>
          </div>
          <span className="badge">Placeholder</span>
        </div>
        <div className="stack-list">
          <div className="metric-pill">
            Status: <strong>Menunggu integrasi model</strong>
          </div>
          <div className="inline-note">
            Nantinya halaman ini bisa diisi untuk hasil training model, evaluasi forecast, dan output prediksi ke modul planning.
          </div>
        </div>
        <div className="footer-strip">
          <Link href="/forecasting/eda" className="chip-button">
            Ke EDA
          </Link>
          <Link href="/planning" className="chip-button is-active">
            Buka Planning
          </Link>
        </div>
      </section>
    </main>
  );
}
