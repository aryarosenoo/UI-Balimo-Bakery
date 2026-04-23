/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TABS = ["Dashboard", "MPS", "MRP", "RCCP", "CRP / Kapasitas", "Output Jadwal", "Rute & Toko"];
const PERIOD_OPTIONS = [10, 20, 52, 104];
const AUTO_REFRESH_MS = 5000;
const WC_COLORS = ["#f97316", "#38bdf8", "#22c55e", "#e879f9", "#facc15", "#fb7185", "#c4b5fd"];
const MRP_CATEGORY_COLORS = {
  raw_material: "#f97316",
  intermediate: "#38bdf8",
  final_product: "#22c55e",
};

function formatNumber(value, options = {}) {
  return new Intl.NumberFormat("id-ID", options).format(Number(value || 0));
}

function formatPercent(value) {
  return `${formatNumber(value, { maximumFractionDigits: 1 })}%`;
}

function formatMinutes(value) {
  return `${formatNumber(value, { maximumFractionDigits: 0 })} mnt`;
}

function formatMinutesPerWeek(value, options = { maximumFractionDigits: 0 }) {
  return `${formatNumber(value, options)} mnt/week`;
}

function formatClock(value) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function formatLotSize(value) {
  if (typeof value === "string") {
    return value || "-";
  }
  return formatNumber(value, { maximumFractionDigits: 0 });
}

function getWorkCenterColor(index) {
  return WC_COLORS[index % WC_COLORS.length];
}

function getMrpCategoryColor(categoryKey) {
  return MRP_CATEGORY_COLORS[categoryKey] || "#94a3b8";
}

function Card({ title, subtitle, extra, children, style }: any) {
  return (
    <section className="panel" style={style}>
      {(title || subtitle || extra) && (
        <div className="panel-header">
          <div>
            {title ? <h2 className="panel-title">{title}</h2> : null}
            {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
          </div>
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}

function StatCard({ icon, label, value, meta, toneClass = "tonal-orange" }: any) {
  return (
    <section className="panel stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneClass}`}>{value}</div>
      <div className="stat-meta">{meta}</div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="loading-state">
      <div className="loading-card">
        <h2>Memuat dashboard DSS</h2>
        <p>Frontend sedang mengambil data dari backend dan workbook Excel di folder `Data TA`.</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: any) {
  return (
    <div className="error-state">
      <div className="error-card">
        <h2>Data belum bisa dibuka</h2>
        <p>{message}</p>
        <div className="footer-strip">
          <button className="chip-button is-active" onClick={onRetry}>
            Coba Lagi
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusLabel({ status }: any) {
  return (
    <span className="status-label" style={{ color: status?.color || "#94a3b8" }}>
      {status?.label || "Normal"}
    </span>
  );
}

function CapacitySection({
  title,
  subtitle,
  plan,
  viewPeriods,
  loadChartTitle,
  loadChartSubtitle,
  utilizationTitle,
  utilizationSubtitle,
  tableTitle,
  tableSubtitle,
}: any) {
  const periods = plan?.periods ?? [];
  const workCenters = plan?.work_centers ?? [];

  return (
    <>
      <Card title={title} subtitle={subtitle}>
        <div className="footer-strip" style={{ marginTop: 0 }}>
          <span className="metric-pill">
            Total available time: <strong>{formatMinutesPerWeek(plan?.total_available_minutes || 0)}</strong>
          </span>
          <span className="metric-pill">
            Total kapasitas master: <strong>{formatMinutesPerWeek(plan?.total_capacity_minutes || 0)}</strong>
          </span>
          <span className="metric-pill">
            Work center aktif: <strong>{formatNumber(workCenters.length)}</strong>
          </span>
        </div>
        <div className="inline-note">{plan?.policy || "Belum ada kebijakan kapasitas."}</div>
      </Card>

      <div className="panel-grid cols-3" style={{ marginTop: 16 }}>
        {workCenters.map((workCenter, index) => (
          <Card
            key={workCenter.id}
            title={workCenter.id}
            subtitle={workCenter.name}
            extra={<span className="badge">{formatMinutesPerWeek(workCenter.available_time_minutes)} available</span>}
          >
            <div className="metric-pill" style={{ marginBottom: 10 }}>
              Avg util: <strong style={{ color: getWorkCenterColor(index) }}>{formatPercent(workCenter.average_utilization_pct)}</strong>
            </div>
            <div className="metric-pill" style={{ marginBottom: 10 }}>
              Planning factor: <strong>{formatPercent(workCenter.planning_factor_pct)}</strong>
            </div>
            <div className="metric-pill" style={{ marginBottom: 10 }}>
              Peak util: <strong>{formatPercent(workCenter.peak_utilization_pct)}</strong> di <strong>{workCenter.peak_period}</strong>
            </div>
            <div className="metric-pill">
              Beban total: <strong>{formatMinutes(workCenter.load_values.reduce((sum, value) => sum + value, 0))}</strong>
            </div>
          </Card>
        ))}
      </div>

      <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
        <Card title={loadChartTitle} subtitle={loadChartSubtitle}>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={periods}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: 14,
                  }}
                />
                <Legend />
                <Bar dataKey="total_load_minutes" name="Load (mnt/week)" fill="#f97316" radius={[8, 8, 0, 0]} />
                <Bar dataKey="total_available_minutes" name="Available Time (mnt/week)" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={utilizationTitle} subtitle={utilizationSubtitle}>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={periods}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: 14,
                  }}
                />
                <Legend />
                {workCenters.map((workCenter, index) => (
                  <Line
                    key={workCenter.id}
                    type="monotone"
                    dataKey={workCenter.id}
                    name={workCenter.id}
                    stroke={getWorkCenterColor(index)}
                    strokeWidth={2.25}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card
        title={tableTitle}
        subtitle={tableSubtitle}
        extra={<span className="badge">{viewPeriods} minggu</span>}
        style={{ marginTop: 16 }}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sticky-col">Work Center</th>
                {periods.map((period) => (
                  <th key={period.period} className="center">
                    {period.period}
                  </th>
                ))}
                <th className="right">Avg Load</th>
                <th className="right">Avail/Week</th>
              </tr>
            </thead>
            <tbody>
              {workCenters.map((workCenter) => (
                <tr key={workCenter.id}>
                  <td className="sticky-col">
                    <strong>{workCenter.id}</strong> | {workCenter.name}
                  </td>
                  {workCenter.load_values.map((loadValue, index) => {
                    const availableValue = workCenter.available_time_values[index];
                    const isOverload = availableValue > 0 && loadValue > availableValue;
                    const isTight = availableValue > 0 && loadValue / availableValue > 0.8;
                    return (
                      <td
                        key={`${workCenter.id}-${index}`}
                        className="center"
                        style={{
                          color: isOverload ? "#fca5a5" : isTight ? "#fdba74" : "#86efac",
                          background: isTight ? "rgba(249,115,22,0.08)" : "transparent",
                        }}
                        title={`Load ${formatMinutesPerWeek(loadValue, { maximumFractionDigits: 1 })} | Available ${formatMinutesPerWeek(availableValue, { maximumFractionDigits: 1 })}`}
                      >
                        {`${formatNumber(loadValue, { maximumFractionDigits: 1 })} / ${formatNumber(availableValue, { maximumFractionDigits: 1 })}`}
                      </td>
                    );
                  })}
                  <td className="right tonal-blue">
                    <strong>{formatMinutesPerWeek(
                      workCenter.load_values.reduce((sum, value) => sum + value, 0) / (workCenter.load_values.length || 1),
                      { maximumFractionDigits: 1 },
                    )}</strong>
                  </td>
                  <td className="right tonal-green">
                    <strong>{formatMinutesPerWeek(workCenter.available_time_minutes, { maximumFractionDigits: 1 })}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function App() {
  const [tab, setTab] = useState(0);
  const [viewPeriods, setViewPeriods] = useState(20);
  const [selectedComponent, setSelectedComponent] = useState("");
  const [selectedMrpCategory, setSelectedMrpCategory] = useState("raw_material");
  const [selectedRoute, setSelectedRoute] = useState("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const hasPayloadRef = useRef(false);
  const inFlightRef = useRef(false);
  const activeControllerRef = useRef(null);

  useEffect(() => {
    hasPayloadRef.current = payload !== null;
  }, [payload]);

  useEffect(() => {
    let isActive = true;

    async function fetchPayload(backgroundRefresh = false) {
      if (inFlightRef.current) {
        return;
      }

      const controller = new AbortController();
      const params = new URLSearchParams({ periods: String(viewPeriods) });
      if (selectedComponent) {
        params.set("component_id", selectedComponent);
      }

      const shouldShowBlockingLoader = !backgroundRefresh || !hasPayloadRef.current;

      inFlightRef.current = true;
      activeControllerRef.current = controller;

      if (shouldShowBlockingLoader) {
        setLoading(true);
      }
      if (!backgroundRefresh) {
        setError("");
      }

      try {
        const response = await fetch(`/api/dss?${params.toString()}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.detail || "Gagal memuat data dari backend.");
        }
        if (!isActive) {
          return;
        }

        setPayload(body);
        setLastSyncedAt(new Date());
        setError("");
        setSelectedMrpCategory((previous) => {
          const keys = body.mrp.categories.map((item) => item.key);
          if (previous && keys.includes(previous)) {
            return previous;
          }
          return body.mrp.selected_category || keys[0] || "raw_material";
        });
        setSelectedComponent((previous) => {
          const ids = body.mrp.items.map((item) => item.id);
          if (previous && ids.includes(previous)) {
            return previous;
          }
          return body.meta.selected_component_id || body.mrp.selected_item?.id || "";
        });
      } catch (caughtError) {
        if (caughtError.name === "AbortError" || !isActive) {
          return;
        }
        setError(caughtError.message || "Terjadi kesalahan yang tidak diketahui.");
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
        }
        inFlightRef.current = false;
        if (shouldShowBlockingLoader && isActive) {
          setLoading(false);
        }
      }
    }

    fetchPayload(false);

    const intervalId = autoRefresh
      ? window.setInterval(() => {
          fetchPayload(true);
        }, AUTO_REFRESH_MS)
      : null;

    return () => {
      isActive = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
      inFlightRef.current = false;
    };
  }, [autoRefresh, reloadToken, selectedComponent, viewPeriods]);

  if (loading && !payload) {
    return <LoadingState />;
  }

  if (error && !payload) {
    return <ErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />;
  }

  const dashboard = payload?.dashboard ?? {};
  const mps = payload?.mps ?? { periods: [], rows: [] };
  const mrp = payload?.mrp ?? { categories: [], items: [], items_by_category: {}, periods: [] };
  const rccp = payload?.rccp ?? { periods: [], work_centers: [] };
  const crp = payload?.crp ?? payload?.capacity ?? { periods: [], work_centers: [] };
  const capacity = crp;
  const schedule = payload?.schedule ?? { weeks: [] };
  const routes = payload?.routes ?? { routes: [], stores: [] };

  const activeMrpItems = mrp.items_by_category?.[selectedMrpCategory] ?? [];
  const selectedMrpItem =
    mrp.items.find((item) => item.id === (mrp.selected_item?.id || selectedComponent)) ||
    mrp.selected_item ||
    null;
  const filteredRoutes =
    selectedRoute === "ALL"
      ? routes.routes
      : routes.routes.filter((route) => route.id === selectedRoute);
  const peakLoad = dashboard.peak_load?.bottleneck || null;
  const visibleSheets = payload?.meta?.visible_sheets || [];

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-top">
            <div className="brand">
              <div className="brand-mark">B</div>
              <div className="brand-copy">
                <h1>BAKERY DSS SCHEDULING SYSTEM</h1>
                <p>Frontend React dan backend FastAPI terhubung langsung ke workbook Excel pada folder `Data TA`.</p>
              </div>
            </div>

            <div className="source-stack">
              <div className="source-pill">
                <span>Sumber data</span>
                <code>{payload?.meta?.source_name || "-"}</code>
              </div>
              <div className="metric-pill">
                Horizon tersedia: <strong>{payload?.meta?.available_periods || 0} minggu</strong>
              </div>
              <div className="metric-pill">
                Sinkron terakhir: <strong>{formatClock(lastSyncedAt)}</strong>
              </div>
            </div>
          </div>

          <div className="hero-actions">
            <div className="tab-row">
              {TABS.map((label, index) => (
                <button
                  key={label}
                  className={`tab-button ${tab === index ? "is-active" : ""}`}
                  onClick={() => setTab(index)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="period-row">
              {PERIOD_OPTIONS.map((period) => (
                <button
                  key={period}
                  className={`period-button ${viewPeriods === period ? "is-active" : ""}`}
                  onClick={() => setViewPeriods(period)}
                >
                  {period}W
                </button>
              ))}
              <button
                className={`period-button ${autoRefresh ? "is-active" : ""}`}
                onClick={() => setAutoRefresh((value) => !value)}
              >
                {autoRefresh ? `Auto-sync ON (${AUTO_REFRESH_MS / 1000}s)` : "Auto-sync OFF"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="content">
        {error ? (
          <div className="inline-note">
            Backend masih mengembalikan pesan: <strong>{error}</strong>
          </div>
        ) : null}

        {tab === 0 && (
          <>
            <div className="panel-grid cols-4">
              <StatCard
                icon="PP"
                label="Total Produksi"
                value={formatNumber(dashboard.total_production)}
                meta={`${viewPeriods} minggu terpilih`}
                toneClass="tonal-orange"
              />
              <StatCard
                icon="WC"
                label="Avg Utilisasi"
                value={formatPercent(dashboard.average_capacity_utilization)}
                meta={`${formatNumber(capacity.work_centers?.length || 0)} work center aktif`}
                toneClass="tonal-green"
              />
              <StatCard
                icon="PK"
                label="Peak Bottleneck"
                value={peakLoad ? formatPercent(peakLoad.utilization_pct) : "0%"}
                meta={peakLoad ? `${peakLoad.id} | ${peakLoad.name}` : "Belum ada data"}
                toneClass="tonal-purple"
              />
              <StatCard
                icon="MRP"
                label="MRP Visible"
                value={formatNumber(dashboard.mrp_raw_material_count)}
                meta={`${formatNumber(dashboard.mrp_intermediate_count)} intermediate | ${formatNumber(dashboard.mrp_final_count)} final`}
                toneClass="tonal-blue"
              />
            </div>

            <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
              <Card
                title="Total Produksi per Minggu"
                subtitle="Data diambil langsung dari sheet Master Production Schedule."
                extra={<span className="badge">{viewPeriods} periode</span>}
              >
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={mps.periods}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid rgba(148,163,184,0.2)",
                          borderRadius: 14,
                        }}
                      />
                      <Bar dataKey="total" fill="#f97316" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card
                title="Distribusi Produksi per Produk"
                subtitle="Porsi tiap item terhadap total produksi pada horizon yang dipilih."
              >
                <div className="legend-list">
                  {dashboard.distribution?.map((item) => (
                    <div className="legend-item" key={item.id}>
                      <div className="legend-top">
                        <span className="legend-name">{item.name}</span>
                        <span className="legend-value" style={{ color: item.color }}>
                          {formatNumber(item.total)} | {formatPercent(item.share_pct)}
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-bar"
                          style={{ width: `${item.share_pct}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
              <Card
                title="Utilisasi Kapasitas"
                subtitle="Perbandingan antara total beban CRP visible dan kapasitas efektif seluruh work center."
              >
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={capacity.periods}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid rgba(148,163,184,0.2)",
                          borderRadius: 14,
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="total_utilization_pct" name="Total Utilisasi" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="bottleneck_utilization_pct" name="Bottleneck" stroke="#f97316" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card
                title="Ringkasan Data Aktif"
                subtitle="Workbook visible yang sedang dipakai backend."
              >
                <div className="stack-list">
                  <div className="metric-pill">
                    File aktif: <strong>{payload?.meta?.source_path || "-"}</strong>
                  </div>
                  <div className="metric-pill">
                    Sheet visible dipakai: <strong>{formatNumber(visibleSheets.length)}</strong>
                  </div>
                  <div className="metric-pill">
                    MRP bahan baku: <strong>{formatNumber(dashboard.mrp_raw_material_count)}</strong>
                  </div>
                  <div className="metric-pill">
                    MRP intermediate: <strong>{formatNumber(dashboard.mrp_intermediate_count)}</strong>
                  </div>
                  <div className="metric-pill">
                    Work center termonitor: <strong>{formatNumber(capacity.work_centers?.length || 0)}</strong>
                  </div>
                  <div className="metric-pill">
                    Workbook tersedia: <strong>{formatNumber(payload?.files?.length || 0)}</strong>
                  </div>
                </div>
                <div className="inline-note">
                  Backend hanya membaca sheet visible. Hidden sheet tidak dipakai langsung sebagai sumber data API.
                </div>
                <div className="inline-note">
                  Saat auto-sync aktif, perubahan Excel akan muncul setelah file disimpan, biasanya dalam sekitar {AUTO_REFRESH_MS / 1000} detik.
                </div>
              </Card>
            </div>
          </>
        )}

        {tab === 1 && (
          <Card
            title="Jadwal Induk Produksi"
            subtitle="Semua nilai di tabel berasal dari sheet Master Production Schedule."
            extra={<span className="badge">{viewPeriods} minggu</span>}
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="sticky-col">Produk</th>
                    {mps.periods.map((period) => (
                      <th key={period.period} className="center">
                        {period.period}
                      </th>
                    ))}
                    <th className="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {mps.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="sticky-col">
                        <span className="product-tag">
                          <span className="product-dot" style={{ background: row.color }} />
                          {row.name}
                        </span>
                      </td>
                      {row.values.map((value, index) => (
                        <td
                          key={`${row.id}-${index}`}
                          className="center"
                          style={{
                            color: value > 0 ? row.color : "#475569",
                            background: value > 0 ? `${row.color}14` : "transparent",
                            fontWeight: value > 0 ? 700 : 500,
                          }}
                        >
                          {value > 0 ? formatNumber(value) : "-"}
                        </td>
                      ))}
                      <td className="right" style={{ color: row.color, fontWeight: 700 }}>
                        {formatNumber(row.total)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="sticky-col"><strong>TOTAL</strong></td>
                    {mps.periods.map((period) => (
                      <td key={`total-${period.period}`} className="center tonal-orange">
                        <strong>{formatNumber(period.total)}</strong>
                      </td>
                    ))}
                    <td className="right tonal-orange">
                      <strong>{formatNumber(mps.total_production)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 2 && (
          <>
            <Card
              title="Material Requirement Planning"
              subtitle="Semua nilai MRP mengikuti sheet `MRP` yang visible. Pilih kategori lalu klik item untuk melihat detail periodenya."
            >
              <div className="chip-row">
                {mrp.categories?.map((category) => (
                  <button
                    key={category.key}
                    className={`chip-button ${selectedMrpCategory === category.key ? "is-active" : ""}`}
                    onClick={() => {
                      setSelectedMrpCategory(category.key);
                      const firstItem = mrp.items_by_category?.[category.key]?.[0];
                      if (firstItem) {
                        setSelectedComponent(firstItem.id);
                      }
                    }}
                  >
                    {category.label} ({formatNumber(category.count)})
                  </button>
                ))}
              </div>

              <div className="footer-strip">
                <span className="metric-pill">
                  Item aktif: <strong>{selectedMrpItem?.label || "-"}</strong>
                </span>
                <span className="metric-pill">
                  Sheet visible: <strong>{visibleSheets.includes("MRP") ? "MRP" : "-"}</strong>
                </span>
                <span className="metric-pill">
                  Kebijakan: <strong>{mrp.policy || "-"}</strong>
                </span>
              </div>
            </Card>

            <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
              <Card
                title={`Daftar ${mrp.categories?.find((category) => category.key === selectedMrpCategory)?.label || "Item MRP"}`}
                subtitle="Tabel ringkas seluruh item pada kategori terpilih."
                extra={
                  <span
                    className="badge"
                    style={{
                      background: `${getMrpCategoryColor(selectedMrpCategory)}22`,
                      borderColor: `${getMrpCategoryColor(selectedMrpCategory)}44`,
                      color: getMrpCategoryColor(selectedMrpCategory),
                    }}
                  >
                    {formatNumber(activeMrpItems.length)} item
                  </span>
                }
              >
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Item</th>
                        <th className="center">Lot Size</th>
                        <th className="center">LT</th>
                        <th className="right">Gross</th>
                        <th className="right">Net</th>
                        <th className="right">PORcpt</th>
                        <th className="right">PORel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMrpItems.map((item) => {
                        const isActive = selectedMrpItem?.id === item.id;
                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedComponent(item.id)}
                            style={{
                              cursor: "pointer",
                              background: isActive ? `${getMrpCategoryColor(item.category)}18` : "transparent",
                            }}
                          >
                            <td style={{ color: getMrpCategoryColor(item.category), fontWeight: 700 }}>
                              {item.code || "-"}
                            </td>
                            <td>{item.name}</td>
                            <td className="center">{formatLotSize(item.lot_size)}</td>
                            <td className="center">{formatNumber(item.lead_time)}</td>
                            <td className="right">{formatNumber(item.total_gross_requirement)}</td>
                            <td className="right tonal-orange">{formatNumber(item.total_net_requirement)}</td>
                            <td className="right tonal-blue">{formatNumber(item.total_planned_order_receipt)}</td>
                            <td className="right tonal-green">{formatNumber(item.total_planned_order_release)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card
                title={`Detail MRP | ${selectedMrpItem?.name || "-"}`}
                subtitle={
                  selectedMrpItem
                    ? `${selectedMrpItem.category_label} | Lot Size ${formatLotSize(selectedMrpItem.lot_size)} | LT ${formatNumber(selectedMrpItem.lead_time)}`
                    : "Pilih item MRP untuk melihat detail kebutuhan."
                }
              >
                <div className="footer-strip" style={{ marginTop: 0, marginBottom: 12 }}>
                  <span className="metric-pill">
                    Gross total: <strong>{formatNumber(selectedMrpItem?.total_gross_requirement || 0)}</strong>
                  </span>
                  <span className="metric-pill">
                    Net total: <strong>{formatNumber(selectedMrpItem?.total_net_requirement || 0)}</strong>
                  </span>
                  <span className="metric-pill">
                    PORel total: <strong>{formatNumber(selectedMrpItem?.total_planned_order_release || 0)}</strong>
                  </span>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Periode</th>
                        <th className="center">Gross Req</th>
                        <th className="center">Sched Rcpt</th>
                        <th className="center">Proj On Hand</th>
                        <th className="center">Net Req</th>
                        <th className="center">PORcpt</th>
                        <th className="center">PORel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mrp.periods?.map((row) => (
                        <tr key={row.period}>
                          <td>{row.period}</td>
                          <td className="center">{formatNumber(row.gross_requirement)}</td>
                          <td className="center">{formatNumber(row.scheduled_receipt)}</td>
                          <td className="center">{formatNumber(row.projected_on_hand)}</td>
                          <td className="center tonal-orange">{formatNumber(row.net_requirement)}</td>
                          <td className="center tonal-blue">{formatNumber(row.planned_order_receipt)}</td>
                          <td className="center tonal-green">{formatNumber(row.planned_order_release)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ width: "100%", height: 240, marginTop: 16 }}>
                  <ResponsiveContainer>
                    <LineChart data={mrp.periods}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0f172a",
                          border: "1px solid rgba(148,163,184,0.2)",
                          borderRadius: 14,
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="gross_requirement" name="Gross Requirement" stroke="#f97316" strokeWidth={2.25} dot={false} />
                      <Line type="monotone" dataKey="planned_order_receipt" name="Planned Order Receipt" stroke="#38bdf8" strokeWidth={2.25} dot={false} />
                      <Line type="monotone" dataKey="planned_order_release" name="Planned Order Release" stroke="#22c55e" strokeWidth={2.25} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="inline-note">{mrp.policy}</div>
              </Card>
            </div>
          </>
        )}

        {tab === 3 && (
          <CapacitySection
            title="Rough-Cut Capacity Planning"
            subtitle='RCCP mengikuti nilai pada sheet visible "BOL + RCCP", termasuk load mingguan dan available time per work center.'
            plan={rccp}
            viewPeriods={viewPeriods}
            loadChartTitle="Load vs Available Time RCCP"
            loadChartSubtitle='Perbandingan load rough-cut terhadap available time mingguan dari sheet visible "BOL + RCCP".'
            utilizationTitle="Utilisasi RCCP per Work Center"
            utilizationSubtitle='Garis utilisasi rough-cut untuk semua work center yang tercantum pada sheet visible "BOL + RCCP".'
            tableTitle="Tabel Utilisasi RCCP"
            tableSubtitle='Nilai tabel ditulis sebagai "load / available time" dalam menit/week berdasarkan sheet visible "BOL + RCCP".'
          />
        )}

        {tab === 4 && (
          <CapacitySection
            title="Capacity Requirements Planning"
            subtitle='CRP memakai total kebutuhan kapasitas dari sheet visible "CRP". Available time ditampilkan terpisah dari load agar mudah dibandingkan.'
            plan={crp}
            viewPeriods={viewPeriods}
            loadChartTitle="Load vs Available Time CRP"
            loadChartSubtitle="Perbandingan total kebutuhan kapasitas detail terhadap available time work center."
            utilizationTitle="Utilisasi CRP per Work Center"
            utilizationSubtitle="Garis utilisasi seluruh WC berdasarkan total kebutuhan kapasitas pada sheet CRP visible."
            tableTitle="Tabel Utilisasi CRP"
            tableSubtitle='Nilai tabel ditulis sebagai "load / available time" dalam menit/week dan sumbernya hanya dari sheet visible "CRP".'
          />
        )}

        {tab === 5 && (
          <>
            <div className="panel-grid cols-2">
              <Card
                title="Planned Production Order"
                subtitle="Rekap produk yang diproduksi pada minggu-minggu awal horizon."
              >
                <div className="stack-list">
                  {schedule.weeks?.slice(0, 10).map((week) => (
                    <div className="schedule-card" key={week.period}>
                      <div className="schedule-head">
                        <div>
                          <div className="schedule-period">{week.period}</div>
                          <div className="schedule-total">{formatNumber(week.total)} pcs</div>
                        </div>
                        <StatusLabel status={week.status} />
                      </div>
                      <div className="pills">
                        {week.products.map((product) => (
                          <div className="mini-pill" key={`${week.period}-${product.id}`}>
                            <span className="product-dot" style={{ background: product.color }} />
                            <span>{product.name}</span>
                            <strong>{formatNumber(product.quantity)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card
                title="Master Delivery Route"
                subtitle="Daftar rute distribusi dan jumlah toko yang dilayani."
              >
                <div className="stack-list">
                  {routes.routes?.map((route) => (
                    <div className="route-card" key={route.id} style={{ borderColor: `${route.color}44` }}>
                      <div className="route-head">
                        <div>
                          <div className="route-id">{route.id}</div>
                          <div className="route-meta">{route.name}</div>
                        </div>
                        <span className="badge" style={{ background: `${route.color}22`, borderColor: `${route.color}44`, color: route.color }}>
                          {route.day}
                        </span>
                      </div>
                      <div className="footer-strip">
                        <span className="metric-pill">
                          Toko aktif: <strong>{formatNumber(route.store_count)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card
              title="Output Jadwal Akhir"
              subtitle="Ringkasan produksi, rute aktif, dan status kapasitas per minggu."
              extra={<span className="badge">10 minggu awal</span>}
            >
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Minggu</th>
                      <th>Produk Diproduksi</th>
                      <th className="center">Total Qty</th>
                      <th>Rute Aktif</th>
                      <th>Status Kapasitas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.weeks?.slice(0, 10).map((week) => (
                      <tr key={`summary-${week.period}`}>
                        <td>
                          <strong>{week.period}</strong>
                        </td>
                        <td>{week.products.map((product) => product.name).join(", ")}</td>
                        <td className="center">{formatNumber(week.total)}</td>
                        <td>{week.routes.map((route) => route.id).join(", ")}</td>
                        <td>
                          <StatusLabel status={week.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {tab === 6 && (
          <>
            <Card
              title="Filter Rute"
              subtitle="Pilih rute untuk melihat toko yang masuk dalam distribusi."
            >
              <div className="chip-row">
                <button
                  className={`chip-button ${selectedRoute === "ALL" ? "is-active" : ""}`}
                  onClick={() => setSelectedRoute("ALL")}
                >
                  Semua Rute
                </button>
                {routes.routes?.map((route) => (
                  <button
                    key={route.id}
                    className={`chip-button ${selectedRoute === route.id ? "is-active" : ""}`}
                    onClick={() => setSelectedRoute(route.id)}
                  >
                    {route.id}
                  </button>
                ))}
              </div>
            </Card>

            <div className="panel-grid cols-3" style={{ marginTop: 16 }}>
              {filteredRoutes.map((route) => (
                <Card
                  key={route.id}
                  title={`${route.id} | ${route.day}`}
                  subtitle={route.name}
                  extra={<span className="badge" style={{ background: `${route.color}22`, borderColor: `${route.color}44`, color: route.color }}>{formatNumber(route.store_count)} toko</span>}
                >
                  <div className="helper-text">Lokasi awal: {route.start_location_id || "-"} | tujuan: {route.end_location_id || "-"}</div>
                  <div className="route-stores">
                    {route.stores?.length ? (
                      route.stores.map((store) => (
                        <div className="route-store" key={store.id} style={{ color: route.color }}>
                          <span style={{ color: "#cbd5e1" }}>
                            {store.name} | {store.location}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="route-store" style={{ color: "#64748b" }}>
                        Belum ada toko terhubung
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        <div className="footer-strip">
          <span className="metric-pill">
            Produk aktif: <strong>{formatNumber(payload?.products?.length || 0)}</strong>
          </span>
          <span className="metric-pill">
            Item MRP visible: <strong>{formatNumber(mrp.items?.length || 0)}</strong>
          </span>
          <span className="metric-pill">
            Work center termonitor: <strong>{formatNumber(capacity.work_centers?.length || 0)}</strong>
          </span>
          <span className="metric-pill">
            File sumber: <strong>{payload?.meta?.source_name || "-"}</strong>
          </span>
        </div>
      </main>
    </div>
  );
}

export default App;
