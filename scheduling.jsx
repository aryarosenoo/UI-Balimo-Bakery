import { useEffect, useMemo, useRef, useState } from "react";
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

const TABS = ["Dashboard", "MPS", "MRP", "RCCP", "CRP / Kapasitas", "Output Jadwal", "Rute & Toko", "Algoritma Planning", "Database & Forecast"];
const AUTH_STORAGE_KEY = "bakery-dss-current-user-v1";
const LOGIN_USERS = [
  {
    id: "OWN-001",
    username: "owner",
    password: "owner123",
    name: "Owner Balimo",
    role: "owner",
    department: "Owner",
    phone: "081200000000",
  },
  {
    id: "KP-001",
    username: "produksi",
    password: "produksi123",
    name: "Karyawan Produksi",
    role: "production",
    department: "Produksi",
    phone: "081200000001",
  },
  {
    id: "KM-001",
    username: "pemasaran",
    password: "pemasaran123",
    name: "Karyawan Pemasaran",
    role: "marketing",
    department: "Pemasaran",
    phone: "081200000002",
  },
];
const ROLE_PROFILES = {
  owner: {
    label: "Owner",
    title: "Menu Utama Owner",
    home: "owner-dashboard",
    menu: [
      {
        title: "Dashboard Laporan",
        items: [
          { view: "owner-dashboard", label: "Dashboard Laporan" },
          { view: "report-material-orders", label: "Laporan Pemesanan Bahan Baku", level: 1 },
        ],
      },
      {
        title: "Hasil Analisis",
        items: [
          { view: "forecast-result", label: "Hasil Ramalan Permintaan" },
        ],
      },
    ],
    flow: [
      {
        label: "Dashboard Laporan",
        view: "owner-dashboard",
        children: [
          { label: "Laporan Pemesanan Bahan Baku", view: "report-material-orders" },
        ],
      },
      {
        label: "Hasil Ramalan Permintaan",
        view: "forecast-result",
        children: [],
      },
    ],
  },
  production: {
    label: "Karyawan Produksi",
    title: "Menu Utama Karyawan Produksi",
    home: "production-home",
    menu: [
      {
        title: "Menu Pemesanan Bahan Baku",
        items: [
          { view: 4, label: "Halaman CRP" },
          { view: 2, label: "Halaman MRP" },
        ],
      },
      {
        title: "Menu Perencanaan Produksi",
        items: [
          { view: "bill-of-material", label: "Halaman Bill of Material" },
          { view: 5, label: "Halaman Scheduling" },
          { view: 3, label: "Halaman RCCP" },
          { view: 1, label: "Halaman MPS" },
          { view: "forecast-result", label: "Hasil Ramalan Permintaan" },
        ],
      },
      {
        title: "Menu Input Data",
        items: [
          { view: "data-products", label: "Data Produk" },
          { view: "input-product", label: "Input Data Produk Roti", level: 1 },
          { view: "input-material", label: "Input Data Bahan Baku", level: 1 },
          { view: "input-supplier", label: "Input Data Supplier", level: 1 },
          { view: "data-materials", label: "Data Bahan Baku" },
          { view: "input-material-stock", label: "Input Data Stok Bahan Baku", level: 1 },
        ],
      },
    ],
    flow: [
      {
        label: "Menu Pemesanan Bahan Baku",
        children: [
          { label: "Halaman CRP", view: 4 },
          { label: "Halaman MRP", view: 2 },
        ],
      },
      {
        label: "Menu Perencanaan Produksi",
        children: [
          { label: "Halaman Bill of Material", view: "bill-of-material" },
          { label: "Halaman Scheduling", view: 5 },
          { label: "Halaman RCCP", view: 3 },
          { label: "Halaman MPS", view: 1 },
          { label: "Hasil Ramalan Permintaan", view: "forecast-result" },
        ],
      },
      {
        label: "Menu Input Data",
        children: [
          { label: "Data Produk", view: "data-products" },
          { label: "Data Bahan Baku", view: "data-materials" },
        ],
      },
    ],
  },
  marketing: {
    label: "Karyawan Pemasaran",
    title: "Menu Utama Karyawan Pemasaran",
    home: "marketing-home",
    menu: [
      {
        title: "Hasil Pemasaran",
        items: [
          { view: "segmentation", label: "Hasil Segmentasi Toko" },
          { view: "forecast-result", label: "Hasil Ramalan Permintaan", level: 1 },
        ],
      },
      {
        title: "Menu Input Data",
        items: [
          { view: "data-sales", label: "Data Penjualan" },
          { view: "input-product-stock", label: "Input Data Stok Roti", level: 1 },
          { view: "input-sales-qty", label: "Input Data Kuantitas Produk Laku", level: 1 },
          { view: "data-supplier-store", label: "Data Supplier dan Toko" },
          { view: "input-store", label: "Input Data Toko", level: 1 },
        ],
      },
    ],
    flow: [
      {
        label: "Hasil Segmentasi Toko",
        view: "segmentation",
        children: [
          { label: "Hasil Ramalan Permintaan", view: "forecast-result" },
        ],
      },
      {
        label: "Menu Input Data",
        children: [
          { label: "Data Penjualan", view: "data-sales" },
          { label: "Data Supplier dan Toko", view: "data-supplier-store" },
        ],
      },
    ],
  },
};
const FORM_DEFINITIONS = {
  "input-product": {
    title: "Input Data Produk Roti",
    entity: "Produk_Roti",
    subtitle: "Form master Produk_Roti sesuai data dictionary.",
    fields: [
      { label: "Id Produk", name: "id_produk", placeholder: "PRD-001" },
      { label: "Id Kategori", name: "id_kategori", placeholder: "KTG-001" },
      { label: "Nama Produk", name: "nama_produk", placeholder: "Roti Tawar" },
      { label: "Varian Rasa", name: "varian_rasa", placeholder: "Original" },
      { label: "Harga Jual", name: "harga_jual", type: "number", placeholder: "7500" },
      { label: "Satuan", name: "satuan", placeholder: "pcs" },
    ],
  },
  "input-material": {
    title: "Input Data Bahan Baku",
    entity: "Bahan_Baku",
    subtitle: "Form master Bahan_Baku untuk MRP dan pemesanan bahan baku.",
    fields: [
      { label: "Id Bahan Baku", name: "id_bahan_baku", placeholder: "BB-001" },
      { label: "Id Supplier", name: "id_supplier", placeholder: "SUP-001" },
      { label: "Nama Bahan Baku", name: "nama_bahan_baku", placeholder: "Tepung Terigu" },
      { label: "Jenis Bahan Baku", name: "jenis_bahan_baku", placeholder: "Tepung" },
      { label: "Satuan", name: "satuan", placeholder: "kg" },
      { label: "Stok", name: "stok", type: "number", placeholder: "120" },
      { label: "Lead Time", name: "lead_time", type: "number", placeholder: "3" },
      { label: "Harga Satuan", name: "harga_satuan", type: "number", placeholder: "12500" },
    ],
  },
  "input-material-stock": {
    title: "Input Data Stok Bahan Baku",
    entity: "Bahan_Baku",
    subtitle: "Form pembaruan stok bahan baku aktual untuk kebutuhan MRP dan pemesanan bahan baku.",
    fields: [
      { label: "Id Bahan Baku", name: "id_bahan_baku", placeholder: "BB-001" },
      { label: "Nama Bahan Baku", name: "nama_bahan_baku", placeholder: "Tepung Terigu" },
      { label: "Tanggal Input", name: "tanggal_input", type: "date" },
      { label: "Stok Bahan Baku", name: "stok_bahan_baku", type: "number", placeholder: "120" },
      { label: "Satuan", name: "satuan", placeholder: "kg" },
      { label: "Keterangan", name: "keterangan", placeholder: "Stok gudang terbaru" },
    ],
  },
  "input-supplier": {
    title: "Input Data Supplier",
    entity: "Supplier",
    subtitle: "Form data Supplier sesuai data dictionary.",
    fields: [
      { label: "Id Supplier", name: "id_supplier", placeholder: "SUP-001" },
      { label: "Nama Supplier", name: "nama_supplier", placeholder: "PT Sari Gandum" },
      { label: "Alamat", name: "alamat", placeholder: "Bandung" },
      { label: "No Telepon", name: "no_telepon", type: "tel", placeholder: "081200000000" },
    ],
  },
  "input-product-stock": {
    title: "Input Data Stok Roti",
    entity: "Input_Penjualan_Produksi",
    subtitle: "Form catatan stok roti per toko untuk melengkapi data penjualan aktual.",
    fields: [
      { label: "Id Input Penjualan", name: "id_input_penjualan", placeholder: "IPJ-001" },
      { label: "Id Karyawan Produksi", name: "id_karyawan_produksi", placeholder: "KP-001" },
      { label: "Id Toko", name: "id_toko", placeholder: "TK-001" },
      { label: "Id Produk", name: "id_produk", placeholder: "PRD-001" },
      { label: "Tanggal Input", name: "tanggal_input", type: "date" },
      { label: "Periode", name: "periode", type: "number", placeholder: "1" },
      { label: "Stok Roti", name: "stok_roti", type: "number", placeholder: "120" },
      { label: "Keterangan", name: "keterangan", placeholder: "Stok akhir toko" },
    ],
  },
  "input-sales-qty": {
    title: "Input Data Kuantitas Produk Laku",
    entity: "Input_Penjualan_Produksi",
    subtitle: "Form input penjualan aktual yang menjadi sumber Ramalan_Permintaan.",
    fields: [
      { label: "Id Input Penjualan", name: "id_input_penjualan", placeholder: "IPJ-001" },
      { label: "Id Karyawan Produksi", name: "id_karyawan_produksi", placeholder: "KP-001" },
      { label: "Id Toko", name: "id_toko", placeholder: "TK-001" },
      { label: "Id Produk", name: "id_produk", placeholder: "PRD-001" },
      { label: "Tanggal Input", name: "tanggal_input", type: "date" },
      { label: "Periode", name: "periode", type: "number", placeholder: "1" },
      { label: "Jumlah Laku", name: "jumlah_laku", type: "number", placeholder: "24" },
      { label: "Keterangan", name: "keterangan", placeholder: "Penjualan normal" },
    ],
  },
  "input-forecast-demand": {
    title: "Input Ramalan Permintaan",
    entity: "Ramalan_Permintaan",
    subtitle: "Form output forecast yang akan diteruskan ke MPS.",
    fields: [
      { label: "Id Ramalan Permintaan", name: "id_ramalan_permintaan", placeholder: "RML-001" },
      { label: "Id Input Penjualan", name: "id_input_penjualan", placeholder: "IPJ-001" },
      { label: "Id Produk", name: "id_produk", placeholder: "PRD-001" },
      { label: "Periode Ramalan", name: "periode_ramalan", type: "number", placeholder: "1" },
      { label: "Tanggal Ramalan", name: "tanggal_ramalan", type: "date" },
      { label: "Forecasted Demand", name: "forecasted_demand", type: "number", placeholder: "100" },
    ],
  },
  "input-distribution-need": {
    title: "Input Kebutuhan Distribusi",
    entity: "Kebutuhan_distribusi",
    subtitle: "Form rencana kebutuhan distribusi untuk sumber demand MPS.",
    fields: [
      { label: "Id Kebutuhan Distribusi", name: "id_kebutuhan_distribusi", placeholder: "KD-001" },
      { label: "Id Pengguna", name: "id_pengguna", placeholder: "KP-001" },
      { label: "Tanggal Perencanaan", name: "tanggal_perencanaan", type: "date" },
      { label: "Periode", name: "periode", placeholder: "H1-H20" },
      { label: "Status Kebutuhan", name: "status_kebutuhan", placeholder: "draft" },
      { label: "Keterangan", name: "keterangan", placeholder: "Kebutuhan rute Bandung" },
    ],
  },
  "input-distribution-detail": {
    title: "Input Detail Kebutuhan Distribusi",
    entity: "Detail_Kebutuhan_Distribusi",
    subtitle: "Form detail kebutuhan produk per toko.",
    fields: [
      { label: "Id Detail Kebutuhan Distribusi", name: "id_detail_kebutuhan_distribusi", placeholder: "DKD-001" },
      { label: "Id Kebutuhan Distribusi", name: "id_kebutuhan_distribusi", placeholder: "KD-001" },
      { label: "Id Toko", name: "id_toko", placeholder: "TK-001" },
      { label: "Id Produk", name: "id_produk", placeholder: "PRD-001" },
      { label: "Jumlah Kebutuhan", name: "jumlah_kebutuhan", type: "number", placeholder: "60" },
    ],
  },
  "input-store": {
    title: "Input Data Toko",
    entity: "Toko",
    subtitle: "Form master Toko untuk rute, cluster, dan kebutuhan distribusi.",
    fields: [
      { label: "Id Toko", name: "id_toko", placeholder: "TK-001" },
      { label: "Nama Toko", name: "nama_toko", placeholder: "Toko Mawar" },
      { label: "Alamat", name: "alamat", placeholder: "Jl. Merdeka No. 1" },
      { label: "No Telepon", name: "no_telepon", type: "tel", placeholder: "081200000003" },
    ],
  },
  "input-route": {
    title: "Input Data Rute",
    entity: "Rute",
    subtitle: "Form master Rute dengan lokasi awal dan akhir pengiriman.",
    fields: [
      { label: "Id Rute", name: "id_rute", placeholder: "RTE-001" },
      { label: "Id Toko", name: "id_toko", placeholder: "TK-001" },
      { label: "Id Lokasi Awal", name: "id_lokasi_awal", placeholder: "LOK-001" },
      { label: "Id Lokasi Akhir", name: "id_lokasi_akhir", placeholder: "LOK-002" },
      { label: "Nama Rute", name: "nama_rute", placeholder: "Rute Bandung Utara" },
      { label: "Hari Kerja", name: "hari_kerja", placeholder: "Senin" },
    ],
  },
  "input-cluster": {
    title: "Input Data Cluster",
    entity: "Cluster",
    subtitle: "Form cluster toko, rute, produk, dan quantity kirim.",
    fields: [
      { label: "Id Cluster", name: "id_cluster", placeholder: "CLS-001" },
      { label: "Id Toko", name: "id_toko", placeholder: "TK-001" },
      { label: "Id Rute", name: "id_rute", placeholder: "RTE-001" },
      { label: "Id Produk", name: "id_produk", placeholder: "PRD-001" },
      { label: "Qty Kirim Pcs", name: "qty_kirim_pcs", type: "number", placeholder: "48" },
      { label: "Qty Kirim Pcs Float", name: "qty_kirim_pcs_float", type: "number", step: "any", placeholder: "48.5" },
      { label: "Tanggal", name: "tanggal", type: "date" },
    ],
  },
  "input-location": {
    title: "Input Data Lokasi",
    entity: "Lokasi",
    subtitle: "Form master lokasi untuk titik awal dan akhir rute.",
    fields: [
      { label: "Id Lokasi", name: "id_lokasi", placeholder: "LOK-001" },
      { label: "Lokasi", name: "lokasi", placeholder: "Gudang Balimo" },
      { label: "Nomor", name: "nomor", type: "number", placeholder: "1" },
    ],
  },
  "input-material-order": {
    title: "Input Pemesanan Bahan Baku",
    entity: "Pemesanan_Bahan_Baku",
    subtitle: "Form header pemesanan bahan baku sesuai data dictionary.",
    fields: [
      { label: "Id Pemesanan", name: "id_pemesanan", placeholder: "PMB-001" },
      { label: "Id Supplier", name: "id_supplier", placeholder: "SUP-001" },
      { label: "Id Pengguna Pembuat", name: "id_pengguna_pembuat", placeholder: "KP-001" },
      { label: "Id Pengguna Penyetuju", name: "id_pengguna_penyetuju", placeholder: "OWN-001" },
      { label: "Tanggal Pemesanan", name: "tanggal_pemesanan", type: "date" },
      { label: "Status Pemesanan", name: "status_pemesanan", placeholder: "draft" },
      { label: "Status Persetujuan", name: "status_persetujuan", placeholder: "menunggu" },
      { label: "Keterangan", name: "keterangan", placeholder: "Pemesanan dari hasil MRP" },
    ],
  },
  "input-material-order-detail": {
    title: "Input Detail Pemesanan Bahan Baku",
    entity: "Detail_Pemesanan_Bahan_Baku",
    subtitle: "Form detail item bahan baku yang dipesan.",
    fields: [
      { label: "Id Detail Pemesanan", name: "id_detail_pemesanan", placeholder: "DPM-001" },
      { label: "Id Pemesanan", name: "id_pemesanan", placeholder: "PMB-001" },
      { label: "Id Bahan Baku", name: "id_bahan_baku", placeholder: "BB-001" },
      { label: "Id MRP", name: "id_mrp", placeholder: "MRP-001" },
      { label: "Jumlah Pesan", name: "jumlah_pesan", type: "number", placeholder: "25" },
      { label: "Jumlah Terkonfirmasi", name: "jumlah_terkonfirmasi", type: "number", placeholder: "25" },
      { label: "Tanggal Kebutuhan", name: "tanggal_kebutuhan", type: "date" },
      { label: "Tanggal Pengiriman Rencana", name: "tanggal_pengiriman_rencana", type: "date" },
      { label: "Harga Satuan", name: "harga_satuan", type: "number", placeholder: "12500" },
      { label: "Subtotal", name: "subtotal", type: "number", placeholder: "312500" },
      { label: "Status Detail", name: "status_detail", placeholder: "terencana" },
    ],
  },
  "input-production-schedule": {
    title: "Input Jadwal Produksi",
    entity: "Jadwal_Produksi",
    subtitle: "Form jadwal produksi berdasarkan MPS dan MRP.",
    fields: [
      { label: "Id Jadwal Produksi", name: "id_jadwal_produksi", placeholder: "JDP-001" },
      { label: "Id MRP", name: "id_mrp", placeholder: "MRP-001" },
      { label: "Id MPS", name: "id_mps", placeholder: "MPS-001" },
      { label: "Id Produk", name: "id_produk", placeholder: "PRD-001" },
      { label: "Tanggal Mulai", name: "tanggal_mulai", type: "date" },
      { label: "Tanggal Selesai", name: "tanggal_selesai", type: "date" },
      { label: "Jam Mulai", name: "jam_mulai", type: "time" },
      { label: "Jam Selesai", name: "jam_selesai", type: "time" },
      { label: "Durasi Produksi", name: "durasi_produksi", type: "number", placeholder: "120" },
    ],
  },
};
const FIXED_PERIOD_DAYS = 20;
const AUTO_REFRESH_MS = 5000;
const WC_COLORS = ["#22d3ee", "#f59e0b", "#34d399", "#a78bfa", "#60a5fa", "#f472b6", "#facc15"];
const MRP_CATEGORY_COLORS = {
  raw_material: "#f59e0b",
  intermediate: "#22d3ee",
  final_product: "#34d399",
};
const CHART_TICK_COLOR = "#334155";
const CHART_GRID_COLOR = "rgba(15,23,42,0.12)";
const CHART_TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid rgba(15,23,42,0.12)",
  borderRadius: 8,
  color: "#0f172a",
  boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
};
const RAW_MATERIAL_MASTER = [
  { id: "RM-01", name: "Tepung Terigu", unit: "gr", packagePrice: 5900, packageSize: 1000, packageUnit: "gr", aliases: ["tepung", "terigu"] },
  { id: "RM-02", name: "Telur", unit: "butir", packagePrice: 100, packageSize: 1, packageUnit: "butir", aliases: ["telur"] },
  { id: "RM-03", name: "Margarin Palmia Super Cake", unit: "gr", packagePrice: 9000, packageSize: 1000, packageUnit: "gr", aliases: ["margarin", "palmia", "mentega"] },
  { id: "RM-04", name: "Garam Refina", unit: "gr", packagePrice: 100, packageSize: 1, packageUnit: "gr", aliases: ["garam", "refina"] },
  { id: "RM-05", name: "Nesta Irot Cokelat (Isian Roti)", unit: "gr", packagePrice: 14000, packageSize: 1000, packageUnit: "gr", aliases: ["nesta irot coklat", "nesta irot cokelat", "nest irot coklat", "coklat", "cokelat", "isian roti"] },
  { id: "RM-06", name: "Paletta Excellent Strawberry", unit: "gr", packagePrice: 50000, packageSize: 5000, packageUnit: "gr", aliases: ["paletta strawberry", "strawberry"] },
  { id: "RM-07", name: "Paletta Excellent Blueberry", unit: "gr", packagePrice: 55000, packageSize: 1000, packageUnit: "gr", aliases: ["paletta blueberry", "blueberry"] },
  { id: "RM-08", name: "Saf Instant (Gold/Red/Blue) Instant Dry Yeast", unit: "gr", packagePrice: 115000, packageSize: 1000, packageUnit: "gr", aliases: ["saf instant", "instant dry yeast", "ragi", "yeast"] },
  { id: "RM-09", name: "Gula Halus", unit: "gr", packagePrice: 11500, packageSize: 1000, packageUnit: "gr", aliases: ["gula halus"] },
  { id: "RM-10", name: "Indomilk Good Milk Full", unit: "gr", packagePrice: 7500, packageSize: 370, packageUnit: "gr", aliases: ["indomilk", "good milk", "susu", "milk"] },
  { id: "RM-11", name: "Bakerine Plus", unit: "gr", packagePrice: 900000, packageSize: 10000, packageUnit: "gr", aliases: ["bakerine"] },
  { id: "RM-12", name: "Sosis Kimbo", unit: "buah", packagePrice: 48000, packageSize: 26, packageUnit: "buah", aliases: ["sosis", "kimbo"] },
  { id: "RM-13", name: "Saus Tomat ABC", unit: "gr", packagePrice: 13000, packageSize: 1000, packageUnit: "gr", aliases: ["saus tomat", "tomat abc"] },
  { id: "RM-14", name: "Saus Sambal Asli", unit: "gr", packagePrice: 12000, packageSize: 1000, packageUnit: "gr", aliases: ["saus sambal", "sambal asli"] },
  { id: "RM-15", name: "Mayonais", unit: "gr", packagePrice: 25000, packageSize: 1000, packageUnit: "gr", aliases: ["mayonais", "mayonnaise"] },
  { id: "RM-16", name: "Gula Pasir", unit: "gr", packagePrice: 9000, packageSize: 1000, packageUnit: "gr", aliases: ["gula pasir", "gula"] },
  { id: "RM-17", name: "Keju", unit: "gr", packagePrice: 48000, packageSize: 1000, packageUnit: "gr", aliases: ["keju"] },
];
const RAW_MATERIAL_LOOKUP_TEXTS = RAW_MATERIAL_MASTER.flatMap((material) => (
  [material.name, material.id, ...(material.aliases || [])].map((value) => ({
    key: String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    material,
  }))
));
const CORET2_PRODUCTS = [
  { id: "P-01", name: "Roti sosis", history: [42, 45, 47, 50], color: "#0891b2", baseDoughGrams: 598.6 },
  { id: "P-02", name: "Roti coklat keju", history: [36, 38, 41, 43], color: "#f59e0b", baseDoughGrams: 187.73 },
  { id: "P-03", name: "Roti bun keju", history: [32, 34, 36, 38], color: "#34d399", baseDoughGrams: 187.73 },
  { id: "P-04", name: "Roti bun coklat", history: [34, 35, 37, 40], color: "#a78bfa", baseDoughGrams: 187.73 },
  { id: "P-05", name: "Roti bantal susu mentega", history: [48, 50, 53, 55], color: "#60a5fa", baseDoughGrams: 598.6 },
  { id: "P-06", name: "Roti bantal manis gula", history: [45, 47, 49, 52], color: "#f472b6", baseDoughGrams: 598.6 },
  { id: "P-07", name: "Roti bantal keju", history: [41, 44, 46, 49], color: "#facc15", baseDoughGrams: 598.6 },
  { id: "P-08", name: "Roti bantal coklat", history: [44, 46, 48, 51], color: "#14b8a6", baseDoughGrams: 598.6 },
  { id: "P-09", name: "Roti bantal blueberry strawberry", history: [30, 32, 35, 37], color: "#ec4899", baseDoughGrams: 598.6 },
];
const BANTAL_DOUGH_BOM = [
  { materialId: "RM-11", quantity: 11.42 },
  { materialId: "RM-16", quantity: 95.24 },
  { materialId: "RM-01", quantity: 95.24 },
  { materialId: "RM-02", quantity: 2 },
  { materialId: "RM-03", quantity: 238.09 },
  { materialId: "RM-09", quantity: 57.14 },
  { materialId: "RM-04", quantity: 4.76 },
  { materialId: "RM-10", quantity: 11.42 },
  { materialId: "RM-08", quantity: 11.42 },
];
const BUN_DOUGH_BOM = [
  { materialId: "RM-11", quantity: 3.34 },
  { materialId: "RM-16", quantity: 27.78 },
  { materialId: "RM-01", quantity: 27.7 },
  { materialId: "RM-02", quantity: 1 },
  { materialId: "RM-03", quantity: 69.44 },
  { materialId: "RM-09", quantity: 16.67 },
  { materialId: "RM-04", quantity: 1.38 },
  { materialId: "RM-10", quantity: 3.34 },
  { materialId: "RM-08", quantity: 3.34 },
];
const CORET2_BOM = [
  ...BANTAL_DOUGH_BOM.map((entry) => ({ productId: "P-01", ...entry })),
  { productId: "P-01", materialId: "RM-12", quantity: 1 },
  { productId: "P-01", materialId: "RM-13", quantity: 4.76 },
  { productId: "P-01", materialId: "RM-15", quantity: 4.76 },
  { productId: "P-01", materialId: "RM-14", quantity: 4.76 },
  ...BUN_DOUGH_BOM.map((entry) => ({ productId: "P-02", ...entry })),
  { productId: "P-02", materialId: "RM-17", quantity: 0.534 },
  { productId: "P-02", materialId: "RM-05", quantity: 16.67 },
  ...BUN_DOUGH_BOM.map((entry) => ({ productId: "P-03", ...entry })),
  { productId: "P-03", materialId: "RM-17", quantity: 0.534 },
  ...BUN_DOUGH_BOM.map((entry) => ({ productId: "P-04", ...entry })),
  { productId: "P-04", materialId: "RM-05", quantity: 16.67 },
  ...BANTAL_DOUGH_BOM.map((entry) => ({
    productId: "P-05",
    ...entry,
    quantity: entry.materialId === "RM-09" ? 61.9 : entry.quantity,
  })),
  ...BANTAL_DOUGH_BOM.map((entry) => ({
    productId: "P-06",
    ...entry,
    quantity: entry.materialId === "RM-16" ? 100 : entry.quantity,
  })),
  ...BANTAL_DOUGH_BOM.map((entry) => ({ productId: "P-07", ...entry })),
  { productId: "P-07", materialId: "RM-17", quantity: 1.82 },
  ...BANTAL_DOUGH_BOM.map((entry) => ({ productId: "P-08", ...entry })),
  { productId: "P-08", materialId: "RM-05", quantity: 57.15 },
  ...BANTAL_DOUGH_BOM.map((entry) => ({ productId: "P-09", ...entry })),
  { productId: "P-09", materialId: "RM-06", quantity: 4.76 },
  { productId: "P-09", materialId: "RM-07", quantity: 4.76 },
];
const DEFAULT_FORECAST_INPUT = {
  source: "upload",
  horizon_days: 20,
  aggregation: "daily",
  date_column: "tanggal",
  quantity_column: "quantity_laku",
  product_column: "id_product",
  store_column: "id_toko",
  write_to_database: true,
  feed_to_planning: true,
};
const PLANNER_STORAGE_KEY = "bakery-dss-planner-v2";
const DEFAULT_PLANNER_STATE = {
  settings: {
    horizonWeeks: FIXED_PERIOD_DAYS,
    movingAveragePeriods: 4,
    growthPercent: 6,
    serviceBufferPercent: 8,
  },
  products: CORET2_PRODUCTS.map((product) => ({
    ...product,
    active: true,
    lotSize: 1,
    safetyStock: 0,
    leadTimeWeeks: 0,
  })),
  materials: RAW_MATERIAL_MASTER.map((material) => ({
    ...material,
    onHand: 0,
    safetyStock: 0,
    lotSize: material.packageSize,
    leadTimeWeeks: 1,
    supplierId: "SUP-CORET2",
  })),
  suppliers: [
    { id: "SUP-CORET2", name: "Supplier Bahan Baku Coret2", leadTimeDays: 2, contact: "Harga dari data master PostgreSQL" },
  ],
  bom: CORET2_BOM,
  workCenters: [
    { id: "MIX", name: "Mixing", availableMinutes: 2400, setupMinutes: 20 },
    { id: "BAK", name: "Baking", availableMinutes: 2100, setupMinutes: 35 },
    { id: "PAC", name: "Packing", availableMinutes: 2600, setupMinutes: 15 },
  ],
  routing: CORET2_PRODUCTS.flatMap((product) => {
    const isLargeDough = product.baseDoughGrams > 500;
    return [
      { productId: product.id, workCenterId: "MIX", minutesPerUnit: isLargeDough ? 0.62 : 0.45 },
      { productId: product.id, workCenterId: "BAK", minutesPerUnit: isLargeDough ? 0.9 : 0.7 },
      { productId: product.id, workCenterId: "PAC", minutesPerUnit: isLargeDough ? 0.4 : 0.32 },
    ];
  }),
};
function formatNumber(value, options = {}) {
  return new Intl.NumberFormat("id-ID", options).format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${formatNumber(value, { maximumFractionDigits: 1 })}%`;
}

function formatMinutes(value) {
  return `${formatNumber(value, { maximumFractionDigits: 0 })} mnt`;
}

function formatMinutesPerWeek(value, options = { maximumFractionDigits: 0 }) {
  return `${formatNumber(value, options)} mnt/hari`;
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

function getDayPeriodLabel(index) {
  return `H${index + 1}`;
}

function withDayPeriodLabels(rows = []) {
  return rows.slice(0, FIXED_PERIOD_DAYS).map((row, index) => ({
    ...row,
    period: getDayPeriodLabel(index),
  }));
}

function slicePeriodValues(values = []) {
  return values.slice(0, FIXED_PERIOD_DAYS);
}

function sumPeriodValues(values = []) {
  return slicePeriodValues(values).reduce((sum, value) => sum + Number(value || 0), 0);
}

function normalizeMaterialLookupKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getMaterialPricing(item = {}) {
  const directPackagePrice = toPlannerNumber(item.packagePrice ?? item.package_price, NaN);
  const directPackageSize = toPlannerNumber(item.packageSize ?? item.package_size, NaN);
  if (Number.isFinite(directPackagePrice) && Number.isFinite(directPackageSize) && directPackageSize > 0) {
    return {
      id: item.id || item.code || "",
      name: item.name || "",
      usageUnit: item.unit || item.packageUnit || item.package_unit || "unit",
      packagePrice: directPackagePrice,
      packageSize: directPackageSize,
      packageUnit: item.packageUnit || item.package_unit || item.unit || "unit",
      unitCost: directPackagePrice / directPackageSize,
      source: "Data master PostgreSQL",
    };
  }

  const sourceKey = normalizeMaterialLookupKey(`${item?.name || ""} ${item?.code || ""} ${item?.material_name || ""}`);
  const exactMatch = RAW_MATERIAL_LOOKUP_TEXTS.find((entry) => entry.key && sourceKey === entry.key);
  const partialMatch = RAW_MATERIAL_LOOKUP_TEXTS.find((entry) => (
    entry.key && sourceKey && (sourceKey.includes(entry.key) || entry.key.includes(sourceKey))
  ));
  const material = exactMatch?.material || partialMatch?.material || null;
  if (!material) {
    return {
      id: item.id || item.code || "",
      name: item.name || "Bahan tidak dikenal",
      usageUnit: item.unit || "unit",
      packagePrice: 0,
      packageSize: 1,
      packageUnit: item.unit || "unit",
      unitCost: 0,
      source: "Belum tersedia di data master PostgreSQL",
    };
  }

  return {
    id: material.id,
    name: material.name,
    usageUnit: item.unit || material.unit,
    packagePrice: material.packagePrice,
    packageSize: material.packageSize,
    packageUnit: material.packageUnit,
    unitCost: material.packagePrice / material.packageSize,
    source: "Data master PostgreSQL",
  };
}

function getMaterialUnitCost(item) {
  return getMaterialPricing(item).unitCost;
}

function formatMaterialPackagePrice(pricing) {
  return `${formatCurrency(pricing.packagePrice)} / ${formatNumber(pricing.packageSize, { maximumFractionDigits: 3 })} ${pricing.packageUnit}`;
}

function hasMrpMaterialActivity(item = {}) {
  return [
    item.total_gross_requirement,
    item.total_net_requirement,
    item.total_planned_order_receipt,
    item.total_planned_order_release,
  ].some((value) => Math.abs(toPlannerNumber(value, 0)) > 0);
}

function shouldDisplayMrpItem(item = {}) {
  return item.category !== "raw_material" || hasMrpMaterialActivity(item);
}

function buildCoret2BillOfMaterialPayload() {
  const materialById = Object.fromEntries(RAW_MATERIAL_MASTER.map((material) => [material.id, material]));
  const productById = Object.fromEntries(CORET2_PRODUCTS.map((product) => [product.id, product]));
  const lineCounter = {};
  const rows = CORET2_BOM.map((entry) => {
    const material = materialById[entry.materialId] || {};
    const product = productById[entry.productId] || {};
    const lineNo = (lineCounter[entry.productId] || 0) + 1;
    lineCounter[entry.productId] = lineNo;
    return {
      product_id: entry.productId,
      product_name: product.name || entry.productId,
      material_id: entry.materialId,
      material_name: material.name || entry.materialId,
      material_type: "raw_material",
      unit: material.unit || "unit",
      version_code: "BOM-TA",
      description: "BOM dari gambar lampiran",
      line_no: lineNo,
      quantity_per_parent: entry.quantity,
      scrap_factor_pct: 0,
      notes: "1 pcs produk",
    };
  });
  const rowsByProduct = rows.reduce((grouped, row) => {
    grouped[row.product_id] = [...(grouped[row.product_id] || []), row];
    return grouped;
  }, {});
  const products = CORET2_PRODUCTS.map((product) => ({
    id: product.id,
    name: product.name,
    family_name: "Produk Roti",
    color: product.color,
    component_count: rowsByProduct[product.id]?.length || 0,
    components: rowsByProduct[product.id] || [],
  }));
  const componentIds = new Set(rows.map((row) => row.material_id));

  return {
    source: "Data master PostgreSQL + rancangan BOM TA",
    policy: "BOM memakai kebutuhan per 1 pcs produk dari rancangan, sedangkan harga bahan baku mengikuti data master PostgreSQL.",
    products,
    rows,
    product_count: products.length,
    component_count: componentIds.size,
    line_count: rows.length,
  };
}

function getWorkCenterColor(index) {
  return WC_COLORS[index % WC_COLORS.length];
}

function getChartDataKey(value) {
  return `forecast_${String(value || "unknown").replace(/[^A-Za-z0-9]/g, "_")}`;
}

function getMrpCategoryColor(categoryKey) {
  return MRP_CATEGORY_COLORS[categoryKey] || "#94a3b8";
}

function toPlannerNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPlannerNumber(value, min, max, fallback = min) {
  const parsed = toPlannerNumber(value, fallback);
  return Math.min(max, Math.max(min, parsed));
}

function roundUpToLot(value, lotSize) {
  const safeLotSize = Math.max(0.0001, toPlannerNumber(lotSize, 1));
  const safeValue = Math.max(0, toPlannerNumber(value, 0));
  return roundPlannerValue(Math.ceil(safeValue / safeLotSize) * safeLotSize);
}

function averagePlannerValues(values) {
  const numericValues = values.map((value) => toPlannerNumber(value, 0));
  if (!numericValues.length) {
    return 0;
  }
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function makePlannerId(prefix, items) {
  const nextNumber = items.reduce((highest, item) => {
    const match = String(item.id || "").match(/(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
  return `${prefix}-${String(nextNumber).padStart(2, "0")}`;
}

function normalizePlannerState(source = DEFAULT_PLANNER_STATE) {
  const merged = {
    ...DEFAULT_PLANNER_STATE,
    ...source,
    settings: {
      ...DEFAULT_PLANNER_STATE.settings,
      ...(source.settings || {}),
    },
  };
  return {
    ...merged,
    products: (merged.products || []).map((product, index) => ({
      ...product,
      id: product.id || `P-${String(index + 1).padStart(2, "0")}`,
      name: product.name || `Produk ${index + 1}`,
      active: product.active !== false,
      lotSize: Math.max(1, toPlannerNumber(product.lotSize, 1)),
      safetyStock: Math.max(0, toPlannerNumber(product.safetyStock, 0)),
      leadTimeWeeks: Math.max(0, toPlannerNumber(product.leadTimeWeeks, 0)),
      history: [0, 1, 2, 3].map((historyIndex) => toPlannerNumber(product.history?.[historyIndex], 0)),
      color: product.color || WC_COLORS[index % WC_COLORS.length],
    })),
    materials: (merged.materials || []).map((material, index) => {
      const pricing = getMaterialPricing(material);
      return {
        ...material,
        id: material.id || `RM-${String(index + 1).padStart(2, "0")}`,
        name: material.name || `Bahan ${index + 1}`,
        unit: material.unit || pricing.usageUnit || "gr",
        onHand: Math.max(0, toPlannerNumber(material.onHand, 0)),
        safetyStock: Math.max(0, toPlannerNumber(material.safetyStock, 0)),
        lotSize: Math.max(0.01, toPlannerNumber(material.lotSize, pricing.packageSize || 1)),
        leadTimeWeeks: Math.max(0, toPlannerNumber(material.leadTimeWeeks, 0)),
        supplierId: material.supplierId || "",
        packagePrice: Math.max(0, toPlannerNumber(material.packagePrice ?? pricing.packagePrice, 0)),
        packageSize: Math.max(0.0001, toPlannerNumber(material.packageSize ?? pricing.packageSize, 1)),
        packageUnit: material.packageUnit || pricing.packageUnit || material.unit || "unit",
        unitCost: Math.max(0, toPlannerNumber(material.unitCost ?? pricing.unitCost, 0)),
      };
    }),
    suppliers: (merged.suppliers || []).map((supplier, index) => ({
      ...supplier,
      id: supplier.id || `SUP-${String(index + 1).padStart(2, "0")}`,
      name: supplier.name || `Supplier ${index + 1}`,
      leadTimeDays: Math.max(0, toPlannerNumber(supplier.leadTimeDays, 0)),
      contact: supplier.contact || "",
    })),
    bom: (merged.bom || [])
      .map((entry) => ({
        productId: entry.productId,
        materialId: entry.materialId,
        quantity: Math.max(0, toPlannerNumber(entry.quantity, 0)),
      }))
      .filter((entry) => entry.productId && entry.materialId),
    workCenters: (merged.workCenters || []).map((workCenter, index) => ({
      ...workCenter,
      id: workCenter.id || `WC-${String(index + 1).padStart(2, "0")}`,
      name: workCenter.name || `Work Center ${index + 1}`,
      availableMinutes: Math.max(1, toPlannerNumber(workCenter.availableMinutes, 1)),
      setupMinutes: Math.max(0, toPlannerNumber(workCenter.setupMinutes, 0)),
    })),
    routing: (merged.routing || [])
      .map((entry) => ({
        productId: entry.productId,
        workCenterId: entry.workCenterId,
        minutesPerUnit: Math.max(0, toPlannerNumber(entry.minutesPerUnit, 0)),
      }))
      .filter((entry) => entry.productId && entry.workCenterId),
  };
}

function loadPlannerState() {
  if (typeof window === "undefined") {
    return normalizePlannerState(DEFAULT_PLANNER_STATE);
  }
  try {
    const stored = window.localStorage.getItem(PLANNER_STORAGE_KEY);
    return normalizePlannerState(stored ? JSON.parse(stored) : DEFAULT_PLANNER_STATE);
  } catch {
    return normalizePlannerState(DEFAULT_PLANNER_STATE);
  }
}

function savePlannerState(planner) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(planner));
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  const { password, password_hash, passwordHash, ...safeUser } = user;
  return safeUser;
}

function describeFetchError(error, fallback) {
  const message = error?.message || "";
  if (
    message === "Failed to fetch" ||
    message.includes("NetworkError") ||
    message.includes("Load failed")
  ) {
    return "Backend belum bisa dijangkau. Pastikan FastAPI berjalan di http://127.0.0.1:8000 dan frontend memakai proxy /api.";
  }
  return message || fallback;
}

function loadSessionUser() {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) {
    return null;
  }
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.id && parsed?.role) {
      return sanitizeUser(parsed);
    }
  } catch {
    return sanitizeUser(LOGIN_USERS.find((user) => user.id === stored || user.username === stored));
  }
  return sanitizeUser(LOGIN_USERS.find((user) => user.id === stored || user.username === stored));
}

function saveSessionUser(user) {
  if (typeof window === "undefined") {
    return;
  }
  if (user?.id) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sanitizeUser(user)));
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getRoleMenuItems(profile) {
  return profile?.menu?.flatMap((section) => section.items) || [];
}

function roleHasView(profile, view) {
  return (
    view === "change-password" ||
    profile?.home === view ||
    getRoleMenuItems(profile).some((item) => item.view === view)
  );
}

function getViewLabel(profile, view) {
  if (view === "change-password") {
    return "Ganti Password";
  }
  if (view === "bill-of-material") {
    return "Halaman Bill of Material";
  }
  if (profile?.home === view) {
    return profile.title;
  }
  const roleLabel = getRoleMenuItems(profile).find((item) => item.view === view)?.label;
  if (roleLabel) {
    return roleLabel;
  }
  if (typeof view === "number") {
    return TABS[view] || "Menu DSS";
  }
  return "Menu DSS";
}

function getPlannerBomQuantity(planner, productId, materialId) {
  return planner.bom
    .filter((entry) => entry.productId === productId && entry.materialId === materialId)
    .reduce((sum, entry) => sum + toPlannerNumber(entry.quantity, 0), 0);
}

function getPlannerRoutingMinutes(planner, productId, workCenterId) {
  return planner.routing.find((entry) => entry.productId === productId && entry.workCenterId === workCenterId)?.minutesPerUnit || 0;
}

function buildPlannerCapacity(periods, workCenters, loadsByWorkCenter) {
  const periodRows = periods.map((period, index) => {
    let totalLoadMinutes = 0;
    let totalAvailableMinutes = 0;
    let bottleneck = null;

    workCenters.forEach((workCenter) => {
      const load = loadsByWorkCenter[workCenter.id]?.[index] || 0;
      const available = Math.max(1, toPlannerNumber(workCenter.availableMinutes, 1));
      const utilization = (load / available) * 100;
      totalLoadMinutes += load;
      totalAvailableMinutes += available;

      const candidate = {
        id: workCenter.id,
        name: workCenter.name,
        load_minutes: roundPlannerValue(load),
        available_time_minutes: roundPlannerValue(available),
        utilization_pct: roundPlannerValue(utilization),
      };
      if (!bottleneck || candidate.utilization_pct > bottleneck.utilization_pct) {
        bottleneck = candidate;
      }
    });

    return {
      ...period,
      total_load_minutes: roundPlannerValue(totalLoadMinutes),
      total_available_minutes: roundPlannerValue(totalAvailableMinutes),
      total_utilization_pct: totalAvailableMinutes ? roundPlannerValue((totalLoadMinutes / totalAvailableMinutes) * 100) : 0,
      bottleneck: bottleneck || {},
      bottleneck_utilization_pct: bottleneck?.utilization_pct || 0,
    };
  });

  const rows = workCenters.map((workCenter) => {
    const loadValues = periods.map((_, index) => roundPlannerValue(loadsByWorkCenter[workCenter.id]?.[index] || 0));
    const available = Math.max(1, toPlannerNumber(workCenter.availableMinutes, 1));
    const utilizationValues = loadValues.map((load) => roundPlannerValue((load / available) * 100));
    const peakIndex = utilizationValues.reduce(
      (peak, value, index) => (value > utilizationValues[peak] ? index : peak),
      0,
    );
    return {
      ...workCenter,
      load_values: loadValues,
      available_time_values: periods.map(() => available),
      available_time_minutes: available,
      average_utilization_pct: roundPlannerValue(averagePlannerValues(utilizationValues)),
      peak_utilization_pct: utilizationValues[peakIndex] || 0,
      peak_period: periods[peakIndex]?.period || "-",
    };
  });

  return {
    periods: periodRows,
    work_centers: rows,
    total_available_minutes: roundPlannerValue(workCenters.reduce((sum, workCenter) => sum + toPlannerNumber(workCenter.availableMinutes, 0), 0)),
    total_capacity_minutes: roundPlannerValue(workCenters.reduce((sum, workCenter) => sum + toPlannerNumber(workCenter.availableMinutes, 0), 0)),
  };
}

function roundPlannerValue(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(toPlannerNumber(value, 0) * factor) / factor;
}

function buildJohnsonSequence(jobs) {
  const front = jobs
    .filter((job) => job.machine_a_minutes <= job.machine_b_minutes)
    .sort((left, right) => (
      left.machine_a_minutes - right.machine_a_minutes ||
      left.machine_b_minutes - right.machine_b_minutes ||
      left.position - right.position
    ));
  const back = jobs
    .filter((job) => job.machine_a_minutes > job.machine_b_minutes)
    .sort((left, right) => (
      right.machine_b_minutes - left.machine_b_minutes ||
      right.machine_a_minutes - left.machine_a_minutes ||
      left.position - right.position
    ));
  return [...front, ...back];
}

function evaluateFlowShop(sequence, workCenters) {
  const machineReady = workCenters.map(() => 0);
  const operations = [];
  const sequenceRows = [];

  sequence.forEach((job, jobIndex) => {
    let previousMachineFinish = 0;
    workCenters.forEach((workCenter, machineIndex) => {
      const duration = toPlannerNumber(job.durations?.[machineIndex], 0);
      const startMinute = Math.max(machineReady[machineIndex], previousMachineFinish);
      const finishMinute = startMinute + duration;

      if (duration > 0) {
        operations.push({
          step: jobIndex + 1,
          product_id: job.id,
          product_name: job.name,
          work_center_id: workCenter.id,
          work_center_name: workCenter.name,
          start_minute: roundPlannerValue(startMinute),
          finish_minute: roundPlannerValue(finishMinute),
          duration_minutes: roundPlannerValue(duration),
        });
      }

      machineReady[machineIndex] = finishMinute;
      previousMachineFinish = finishMinute;
    });

    sequenceRows.push({
      step: jobIndex + 1,
      id: job.id,
      name: job.name,
      color: job.color,
      quantity: job.quantity,
      processing_times: job.processing_times,
      total_processing_minutes: roundPlannerValue((job.durations || []).reduce((sum, value) => sum + value, 0)),
      completion_time_minutes: roundPlannerValue(previousMachineFinish),
    });
  });

  return {
    makespan_minutes: roundPlannerValue(Math.max(...machineReady, 0)),
    operations,
    sequence: sequenceRows,
  };
}

function buildCdsSchedule(jobs, workCenters) {
  const activeIndexes = workCenters
    .map((_, index) => index)
    .filter((index) => jobs.some((job) => toPlannerNumber(job.processing_times?.[index]?.duration_minutes, 0) > 0));
  const activeWorkCenters = activeIndexes.map((index) => ({
    id: workCenters[index].id,
    name: workCenters[index].name,
    available_time_minutes: roundPlannerValue(
      toPlannerNumber(workCenters[index].available_time_minutes ?? workCenters[index].availableMinutes, 0),
    ),
  }));
  const scheduledJobs = jobs.map((job, position) => {
    const processingTimes = activeIndexes.map((index) => job.processing_times?.[index] || {
      work_center_id: workCenters[index].id,
      work_center_name: workCenters[index].name,
      run_minutes: 0,
      setup_minutes: 0,
      duration_minutes: 0,
    });
    const durations = processingTimes.map((row) => toPlannerNumber(row.duration_minutes, 0));
    return {
      ...job,
      position,
      processing_times: processingTimes,
      durations,
      total_processing_minutes: roundPlannerValue(durations.reduce((sum, value) => sum + value, 0)),
    };
  });

  if (!scheduledJobs.length) {
    return {
      products: [],
      sequence: [],
      operations: [],
      work_centers: activeWorkCenters,
      cds: {
        selected_iteration: null,
        candidate_count: 0,
        makespan_minutes: 0,
        sequence: [],
        sequence_label: "-",
      },
      cds_candidates: [],
    };
  }

  if (activeWorkCenters.length < 2 || scheduledJobs.length < 2) {
    const evaluation = evaluateFlowShop(scheduledJobs, activeWorkCenters);
    return {
      products: scheduledJobs,
      sequence: evaluation.sequence,
      operations: evaluation.operations,
      work_centers: activeWorkCenters,
      cds: {
        selected_iteration: 0,
        candidate_count: 0,
        makespan_minutes: evaluation.makespan_minutes,
        sequence: scheduledJobs.map((job) => job.id),
        sequence_label: scheduledJobs.map((job) => job.id).join(" -> "),
      },
      cds_candidates: [],
    };
  }

  const machineCount = activeWorkCenters.length;
  let bestEvaluation = null;
  let bestSequence = [];
  let bestIteration = 0;
  const candidates = [];

  for (let splitIndex = 1; splitIndex < machineCount; splitIndex += 1) {
    const decoratedJobs = scheduledJobs.map((job) => ({
      ...job,
      machine_a_minutes: roundPlannerValue(job.durations.slice(0, splitIndex).reduce((sum, value) => sum + value, 0)),
      machine_b_minutes: roundPlannerValue(job.durations.slice(machineCount - splitIndex).reduce((sum, value) => sum + value, 0)),
    }));
    const sequence = buildJohnsonSequence(decoratedJobs);
    const evaluation = evaluateFlowShop(sequence, activeWorkCenters);

    candidates.push({
      iteration: splitIndex,
      machine_a: activeWorkCenters.slice(0, splitIndex).map((workCenter) => workCenter.id),
      machine_b: activeWorkCenters.slice(machineCount - splitIndex).map((workCenter) => workCenter.id),
      sequence: sequence.map((job) => job.id),
      sequence_label: sequence.map((job) => job.id).join(" -> "),
      makespan_minutes: evaluation.makespan_minutes,
    });

    if (!bestEvaluation || evaluation.makespan_minutes < bestEvaluation.makespan_minutes) {
      bestEvaluation = evaluation;
      bestSequence = sequence;
      bestIteration = splitIndex;
    }
  }

  const selectedEvaluation = bestEvaluation || evaluateFlowShop(scheduledJobs, activeWorkCenters);
  return {
    products: scheduledJobs,
    sequence: selectedEvaluation.sequence,
    operations: selectedEvaluation.operations,
    work_centers: activeWorkCenters,
    cds: {
      selected_iteration: bestIteration,
      candidate_count: candidates.length,
      makespan_minutes: selectedEvaluation.makespan_minutes,
      sequence: bestSequence.map((job) => job.id),
      sequence_label: bestSequence.map((job) => job.id).join(" -> "),
    },
    cds_candidates: candidates,
  };
}

function getCapacityStatus(utilizationPct) {
  if (utilizationPct > 100) {
    return { key: "overload", label: "Overload", color: "#fb7185" };
  }
  if (utilizationPct >= 85) {
    return { key: "tight", label: "Ketat", color: "#f59e0b" };
  }
  return { key: "ready", label: "Siap", color: "#34d399" };
}

function buildPlannerProcessingTimes(planner, product, quantity) {
  return planner.workCenters.map((workCenter) => {
    const minutesPerUnit = getPlannerRoutingMinutes(planner, product.id, workCenter.id);
    const runMinutes = toPlannerNumber(quantity, 0) * minutesPerUnit;
    const setupMinutes = quantity > 0 && minutesPerUnit > 0 ? toPlannerNumber(workCenter.setupMinutes, 0) : 0;
    return {
      work_center_id: workCenter.id,
      work_center_name: workCenter.name,
      run_minutes: roundPlannerValue(runMinutes),
      setup_minutes: roundPlannerValue(setupMinutes),
      duration_minutes: roundPlannerValue(runMinutes + setupMinutes),
    };
  });
}

function buildPlannerAlgorithm(planner) {
  const settings = planner.settings || DEFAULT_PLANNER_STATE.settings;
  const horizonWeeks = FIXED_PERIOD_DAYS;
  const movingAveragePeriods = Math.round(clampPlannerNumber(settings.movingAveragePeriods, 1, 4, 4));
  const growthFactor = 1 + clampPlannerNumber(settings.growthPercent, -50, 200, 0) / 100;
  const serviceBufferFactor = 1 + clampPlannerNumber(settings.serviceBufferPercent, 0, 200, 0) / 100;
  const periods = Array.from({ length: horizonWeeks }, (_, index) => ({
    week: index + 1,
    period: getDayPeriodLabel(index),
  }));
  const activeProducts = planner.products.filter((product) => product.active !== false);

  const forecastRows = activeProducts.map((product) => {
    const historyValues = (product.history || []).map((value) => toPlannerNumber(value, 0));
    const windowValues = historyValues.slice(-movingAveragePeriods);
    const baseDemand = averagePlannerValues(windowValues);
    const values = periods.map((_, index) => {
      const phasedGrowth = 1 + ((growthFactor - 1) * (index + 1)) / horizonWeeks;
      return Math.max(0, Math.round(baseDemand * phasedGrowth));
    });
    return {
      id: product.id,
      name: product.name,
      color: product.color,
      history: historyValues,
      baseDemand: roundPlannerValue(baseDemand),
      values,
      total: values.reduce((sum, value) => sum + value, 0),
    };
  });

  const mpsRows = forecastRows.map((forecastRow) => {
    const product = activeProducts.find((item) => item.id === forecastRow.id) || {};
    const values = forecastRow.values.map((forecastValue) => (
      roundUpToLot((forecastValue * serviceBufferFactor) + toPlannerNumber(product.safetyStock, 0), product.lotSize)
    ));
    return {
      ...forecastRow,
      values,
      total: values.reduce((sum, value) => sum + value, 0),
      lotSize: product.lotSize,
      safetyStock: product.safetyStock,
    };
  });

  const salesRows = forecastRows.map((forecastRow) => {
    const product = activeProducts.find((item) => item.id === forecastRow.id) || {};
    const mpsRow = mpsRows.find((row) => row.id === forecastRow.id) || { values: [] };
    let availableStock = Math.max(0, toPlannerNumber(product.finishedGoodsStock ?? product.onHand, 0));
    const salesValues = [];
    const endingStockValues = [];
    const lostSalesValues = [];

    forecastRow.values.forEach((forecastValue, index) => {
      availableStock += toPlannerNumber(mpsRow.values?.[index], 0);
      const expectedSales = Math.min(forecastValue, availableStock);
      availableStock -= expectedSales;
      salesValues.push(roundPlannerValue(expectedSales));
      endingStockValues.push(roundPlannerValue(availableStock));
      lostSalesValues.push(roundPlannerValue(Math.max(0, forecastValue - expectedSales)));
    });

    const totalDemand = forecastRow.values.reduce((sum, value) => sum + value, 0);
    const totalSales = salesValues.reduce((sum, value) => sum + value, 0);
    const totalProduction = (mpsRow.values || []).reduce((sum, value) => sum + value, 0);

    return {
      id: forecastRow.id,
      name: forecastRow.name,
      color: forecastRow.color,
      demandValues: forecastRow.values,
      productionValues: mpsRow.values || [],
      salesValues,
      endingStockValues,
      lostSalesValues,
      totalDemand,
      totalProduction,
      totalSales,
      endingStock: endingStockValues.at(-1) || 0,
      lostSales: lostSalesValues.reduce((sum, value) => sum + value, 0),
      fulfillmentRatePct: totalDemand > 0 ? roundPlannerValue((totalSales / totalDemand) * 100) : 100,
    };
  });

  const roughLoads = Object.fromEntries(planner.workCenters.map((workCenter) => [workCenter.id, periods.map(() => 0)]));
  const detailLoads = Object.fromEntries(planner.workCenters.map((workCenter) => [workCenter.id, periods.map(() => 0)]));

  mpsRows.forEach((productRow) => {
    planner.workCenters.forEach((workCenter) => {
      const minutesPerUnit = getPlannerRoutingMinutes(planner, productRow.id, workCenter.id);
      productRow.values.forEach((quantity, index) => {
        roughLoads[workCenter.id][index] += quantity * minutesPerUnit * 0.85;
        detailLoads[workCenter.id][index] += quantity * minutesPerUnit;
        if (quantity > 0 && minutesPerUnit > 0) {
          detailLoads[workCenter.id][index] += toPlannerNumber(workCenter.setupMinutes, 0);
        }
      });
    });
  });

  const rccp = buildPlannerCapacity(periods, planner.workCenters, roughLoads);
  const crp = buildPlannerCapacity(periods, planner.workCenters, detailLoads);

  const mrpRows = planner.materials.map((material) => {
    const grossRequirementValues = periods.map((_, index) => (
      roundPlannerValue(mpsRows.reduce((sum, productRow) => (
        sum + (productRow.values[index] * getPlannerBomQuantity(planner, productRow.id, material.id))
      ), 0))
    ));
    const netRequirementValues = [];
    const plannedOrderReceiptValues = [];
    const plannedOrderReleaseValues = periods.map(() => 0);
    const projectedOnHandValues = [];
    let projectedOnHand = toPlannerNumber(material.onHand, 0);

    grossRequirementValues.forEach((grossRequirement, index) => {
      const netRequirement = Math.max(
        0,
        grossRequirement + toPlannerNumber(material.safetyStock, 0) - projectedOnHand,
      );
      const plannedReceipt = roundUpToLot(netRequirement, material.lotSize);
      const releaseIndex = Math.max(0, index - Math.round(toPlannerNumber(material.leadTimeWeeks, 0)));
      plannedOrderReleaseValues[releaseIndex] += plannedReceipt;
      projectedOnHand = projectedOnHand + plannedReceipt - grossRequirement;

      netRequirementValues.push(roundPlannerValue(netRequirement));
      plannedOrderReceiptValues.push(roundPlannerValue(plannedReceipt));
      projectedOnHandValues.push(roundPlannerValue(projectedOnHand));
    });

    return {
      ...material,
      supplier: planner.suppliers.find((supplier) => supplier.id === material.supplierId),
      grossRequirementValues,
      netRequirementValues,
      projectedOnHandValues,
      plannedOrderReceiptValues,
      plannedOrderReleaseValues: plannedOrderReleaseValues.map((value) => roundPlannerValue(value)),
      totalGrossRequirement: roundPlannerValue(grossRequirementValues.reduce((sum, value) => sum + value, 0)),
      totalPlannedOrderRelease: roundPlannerValue(plannedOrderReleaseValues.reduce((sum, value) => sum + value, 0)),
    };
  });

  const scheduleWeeks = periods.map((period, index) => {
    const products = mpsRows
      .map((productRow) => ({
        id: productRow.id,
        name: productRow.name,
        color: productRow.color,
        quantity: productRow.values[index],
      }))
      .filter((product) => product.quantity > 0);
    const productJobs = products.map((product) => ({
      ...product,
      processing_times: buildPlannerProcessingTimes(planner, product, product.quantity),
    }));
    const materialOrders = mrpRows
      .map((materialRow) => ({
        id: materialRow.id,
        name: materialRow.name,
        unit: materialRow.unit,
        quantity: materialRow.plannedOrderReleaseValues[index],
        supplier: materialRow.supplier?.name || "-",
      }))
      .filter((order) => order.quantity > 0);
    const capacityRow = crp.periods[index] || {};
    const status = getCapacityStatus(capacityRow.bottleneck_utilization_pct || 0);
    const cdsSchedule = buildCdsSchedule(productJobs, planner.workCenters);
    const scheduledProducts = cdsSchedule.products.map((product) => ({
      id: product.id,
      name: product.name,
      color: product.color,
      quantity: product.quantity,
      processing_times: product.processing_times,
      total_processing_minutes: product.total_processing_minutes,
    }));

    return {
      ...period,
      total: scheduledProducts.reduce((sum, product) => sum + product.quantity, 0),
      products: scheduledProducts,
      materialOrders,
      status,
      bottleneck: capacityRow.bottleneck || {},
      work_centers: cdsSchedule.work_centers,
      sequence: cdsSchedule.sequence,
      operations: cdsSchedule.operations,
      cds: cdsSchedule.cds,
      cds_candidates: cdsSchedule.cds_candidates,
    };
  });

  const peakCapacity = crp.periods.reduce(
    (peak, row) => (row.bottleneck_utilization_pct > (peak?.bottleneck_utilization_pct || 0) ? row : peak),
    crp.periods[0] || null,
  );

  return {
    settings: {
      horizonWeeks,
      movingAveragePeriods,
      growthFactor,
      serviceBufferFactor,
    },
    periods,
    forecast: {
      rows: forecastRows,
      total: forecastRows.reduce((sum, row) => sum + row.total, 0),
    },
    mps: {
      rows: mpsRows,
      total: mpsRows.reduce((sum, row) => sum + row.total, 0),
    },
    sales: {
      rows: salesRows,
      totalDemand: salesRows.reduce((sum, row) => sum + row.totalDemand, 0),
      totalProduction: salesRows.reduce((sum, row) => sum + row.totalProduction, 0),
      totalSales: salesRows.reduce((sum, row) => sum + row.totalSales, 0),
      totalEndingStock: salesRows.reduce((sum, row) => sum + row.endingStock, 0),
      totalLostSales: salesRows.reduce((sum, row) => sum + row.lostSales, 0),
      fulfillmentRatePct: (() => {
        const totalDemand = salesRows.reduce((sum, row) => sum + row.totalDemand, 0);
        const totalSales = salesRows.reduce((sum, row) => sum + row.totalSales, 0);
        return totalDemand > 0 ? roundPlannerValue((totalSales / totalDemand) * 100) : 100;
      })(),
    },
    rccp,
    mrp: {
      rows: mrpRows,
      totalGrossRequirement: roundPlannerValue(mrpRows.reduce((sum, row) => sum + row.totalGrossRequirement, 0)),
      totalPlannedOrderRelease: roundPlannerValue(mrpRows.reduce((sum, row) => sum + row.totalPlannedOrderRelease, 0)),
    },
    crp,
    schedule: {
      algorithm: {
        key: "cds",
        name: "Campbell-Dudek-Smith (CDS)",
      },
      weeks: scheduleWeeks,
    },
    peakCapacity,
  };
}

function Card({ title, subtitle, extra, children, style }) {
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

function StatCard({ icon, label, value, meta, toneClass = "tonal-orange" }) {
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
        <p>Frontend sedang mengambil data dari backend PostgreSQL.</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
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

function StatusLabel({ status }) {
  return (
    <span className="status-label" style={{ color: status?.color || "#94a3b8" }}>
      {status?.label || "Normal"}
    </span>
  );
}

function LoginPage({ onLogin, onChangePassword }) {
  const [username, setUsername] = useState(LOGIN_USERS[0].username);
  const [password, setPassword] = useState("");
  const [authUsers, setAuthUsers] = useState(() => LOGIN_USERS.map(sanitizeUser));
  const [authMode, setAuthMode] = useState("login");
  const [changeUsername, setChangeUsername] = useState(LOGIN_USERS[0].username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function fetchAuthUsers() {
      try {
        const response = await fetch("/api/auth/users");
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.detail || "Data pengguna belum bisa dibuka.");
        }
        if (isActive && Array.isArray(body.users) && body.users.length) {
          setAuthUsers(body.users.map(sanitizeUser));
        }
      } catch {
        if (isActive) {
          setAuthUsers(LOGIN_USERS.map(sanitizeUser));
        }
      }
    }

    fetchAuthUsers();
    return () => {
      isActive = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError("");
    const result = await onLogin(username, password);
    setSubmitting(false);
    if (!result.ok) {
      setLoginError(result.message);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordMessage("");
    setLoginError("");
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Konfirmasi password baru belum sama.");
      return;
    }
    setSubmitting(true);
    const result = await onChangePassword({
      username: changeUsername,
      currentPassword,
      newPassword,
    });
    setSubmitting(false);
    if (!result.ok) {
      setPasswordMessage(result.message);
      return;
    }
    setPasswordMessage("Password berhasil diperbarui. Silakan login dengan password baru.");
    setUsername(changeUsername);
    setPassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark">B</div>
          <div>
            <span>Halaman Login</span>
            <h1>Bakery DSS Scheduling System</h1>
            <p>Setelah login, menu utama akan berubah sesuai kategori user: owner, produksi, atau pemasaran.</p>
          </div>
        </div>

        <div className="login-mode-row" role="tablist" aria-label="Mode login">
          <button
            type="button"
            className={`chip-button ${authMode === "login" ? "is-active" : ""}`}
            onClick={() => {
              setAuthMode("login");
              setLoginError("");
              setPasswordMessage("");
            }}
          >
            Masuk
          </button>
          <button
            type="button"
            className={`chip-button ${authMode === "change" ? "is-active" : ""}`}
            onClick={() => {
              setAuthMode("change");
              setLoginError("");
              setPasswordMessage("");
              setChangeUsername(username);
            }}
          >
            Ganti Password
          </button>
        </div>

        {authMode === "login" ? (
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="form-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            {loginError ? <div className="inline-note login-error">{loginError}</div> : null}

            <button className="chip-button is-active login-submit" type="submit" disabled={submitting}>
              {submitting ? "Memproses..." : "Masuk"}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handlePasswordSubmit}>
            <label className="form-field">
              <span>Username</span>
              <input
                value={changeUsername}
                onChange={(event) => setChangeUsername(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="form-field">
              <span>Password Lama</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="form-field">
              <span>Password Baru</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="form-field">
              <span>Konfirmasi Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>

            {passwordMessage ? <div className="inline-note login-error">{passwordMessage}</div> : null}

            <button className="chip-button is-active login-submit" type="submit" disabled={submitting}>
              {submitting ? "Memproses..." : "Simpan Password"}
            </button>
          </form>
        )}

        <div className="login-demo">
          <span>Akun demo</span>
          <div className="chip-row">
            {authUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                className="chip-button"
                onClick={() => {
                  setUsername(user.username);
                  setChangeUsername(user.username);
                  setPassword("");
                  setLoginError("");
                  setPasswordMessage("");
                }}
              >
                {user.department}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MenuBranchCards({ groups, onNavigate }) {
  return (
    <div className="panel-grid cols-3">
      {groups.map((group) => (
        <Card key={group.label} title={group.label} subtitle="Pilih halaman untuk membuka alur kerja.">
          <div className="stack-list">
            {group.children?.map((child) => (
              <button
                key={child.label}
                type="button"
                className="role-action-button"
                onClick={() => onNavigate(child.view)}
              >
                <span>{child.label}</span>
                <strong>Buka</strong>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function RoleHomePage({
  currentUser,
  profile,
  dashboard,
  mps,
  mrp,
  rccp,
  capacity,
  schedule,
  routes,
  viewPeriods,
  onNavigate,
}) {
  if (currentUser.role === "owner") {
    return (
      <>
        <div className="panel-grid cols-4">
          <StatCard
            icon="RP"
            label="Total Produksi"
            value={formatNumber(dashboard.total_production)}
            meta={`${viewPeriods} hari laporan`}
            toneClass="tonal-blue"
          />
          <StatCard
            icon="BB"
            label="Item Bahan Baku"
            value={formatNumber(dashboard.mrp_raw_material_count)}
            meta="Sumber laporan pemesanan"
            toneClass="tonal-orange"
          />
          <StatCard
            icon="FR"
            label="Hasil Ramalan"
            value={formatNumber(mps.rows?.length || 0)}
            meta="Produk dengan demand plan"
            toneClass="tonal-green"
          />
          <StatCard
            icon="WC"
            label="Avg Utilisasi"
            value={formatPercent(dashboard.average_capacity_utilization)}
            meta="Ringkasan kapasitas produksi"
            toneClass="tonal-purple"
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <Card title="Dashboard Laporan" subtitle="Akses ringkasan owner tanpa tampilan tree di dashboard.">
            <div className="stack-list">
              <button className="role-action-button" type="button" onClick={() => onNavigate("report-material-orders")}>
                <span>Halaman Laporan Pemesanan Bahan Baku</span>
                <strong>Buka</strong>
              </button>
              <button className="role-action-button" type="button" onClick={() => onNavigate("forecast-result")}>
                <span>Halaman Hasil Ramalan Permintaan</span>
                <strong>Buka</strong>
              </button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (currentUser.role === "production") {
    return (
      <>
        <div className="panel-grid cols-4">
          <StatCard
            icon="MPS"
            label="MPS Produk"
            value={formatNumber(mps.rows?.length || 0)}
            meta={`${viewPeriods} hari perencanaan`}
            toneClass="tonal-blue"
          />
          <StatCard
            icon="MRP"
            label="Item MRP"
            value={formatNumber(mrp.items?.length || 0)}
            meta="Bahan baku dan komponen"
            toneClass="tonal-orange"
          />
          <StatCard
            icon="RCCP"
            label="Work Center"
            value={formatNumber(rccp.work_centers?.length || 0)}
            meta="Kapasitas rough-cut"
            toneClass="tonal-purple"
          />
          <StatCard
            icon="SCH"
            label="Jadwal"
            value={formatNumber(schedule.weeks?.length || 0)}
            meta="Output produksi aktif"
            toneClass="tonal-green"
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <MenuBranchCards groups={profile.flow} onNavigate={onNavigate} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="panel-grid cols-4">
        <StatCard
          icon="TK"
          label="Toko Aktif"
          value={formatNumber(routes.routes?.reduce((sum, route) => sum + (route.store_count || 0), 0))}
          meta="Dari master rute"
          toneClass="tonal-blue"
        />
        <StatCard
          icon="RT"
          label="Rute"
          value={formatNumber(routes.routes?.length || 0)}
          meta="Segmentasi toko"
          toneClass="tonal-green"
        />
        <StatCard
          icon="FR"
          label="Ramalan Produk"
          value={formatNumber(mps.rows?.length || 0)}
          meta="Demand per produk"
          toneClass="tonal-orange"
        />
        <StatCard
          icon="PK"
          label="Peak Kapasitas"
          value={formatPercent(capacity.periods?.[0]?.bottleneck_utilization_pct || 0)}
          meta="Referensi kesiapan pasokan"
          toneClass="tonal-purple"
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <MenuBranchCards groups={profile.flow} onNavigate={onNavigate} />
      </div>
    </>
  );
}

function ForecastResultPage({
  forecast,
  mps,
  dashboard,
  viewPeriods,
  forecastPredictions,
  designContract,
  forecastLoading,
  forecastError,
  onRefreshForecast,
}) {
  const hasForecastSeries = Boolean(forecastPredictions?.daily?.length);
  const fallbackSource = forecast?.rows?.length ? forecast : mps;
  const fallbackLabel = forecast?.rows?.length ? "PostgreSQL demand_plans" : "Fallback dari MPS";
  const fallbackChartRows = withDayPeriodLabels(fallbackSource.periods || []).map((row) => ({
    ...row,
    total_forecast_pcs: row.total || 0,
    total_shipment_pcs: row.total_customer_order || row.total || 0,
  }));
  const chartRows = hasForecastSeries ? forecastPredictions.daily : fallbackChartRows;
  const fallbackProductRows = [...(fallbackSource.rows || [])]
    .map((row) => ({
      product: row.id,
      product_name: row.name,
      total_forecast_pcs: sumPeriodValues(row.values || []),
      total_shipment_pcs: sumPeriodValues(row.customer_order_values || row.values || []),
      model_count: 0,
      color: row.color,
    }))
    .sort((a, b) => (b.total_forecast_pcs || 0) - (a.total_forecast_pcs || 0));
  const productRows = hasForecastSeries ? forecastPredictions.products || [] : fallbackProductRows;
  const clusterRows = forecastPredictions?.clusters || [];
  const clusterDetails = forecastPredictions?.cluster_details || [];
  const storeRows = forecastPredictions?.stores || [];
  const storeProductRows = forecastPredictions?.store_products || [];
  const routeRows = forecastPredictions?.routes || [];
  const summary = forecastPredictions?.summary || {};
  const demandKpis = designContract?.kpis?.demand_page || [];
  const evaluation = forecastPredictions?.model_evaluation || {};
  const overallMetrics = evaluation.overall || {};
  const modelComparison = evaluation.comparison || [];
  const bestModel = evaluation.best_model || summary.best_model || null;
  const forecastTotal = hasForecastSeries
    ? summary.total_forecast_pcs || 0
    : fallbackProductRows.reduce((sum, row) => sum + (row.total_forecast_pcs || 0), 0);
  const shipmentTotal = hasForecastSeries ? summary.total_shipment_pcs || 0 : forecastTotal;
  const algorithmLabel = forecastPredictions?.meta?.algorithm || `Forecast dari ${fallbackLabel}`;
  const metricValue = (value, options = { maximumFractionDigits: 2 }) => (
    hasForecastSeries && value !== undefined ? formatNumber(value, options) : "-"
  );
  const [selectedClusterId, setSelectedClusterId] = useState("");

  useEffect(() => {
    if (!clusterDetails.length) {
      return;
    }
    if (!selectedClusterId || !clusterDetails.some((cluster) => cluster.cluster === selectedClusterId)) {
      setSelectedClusterId(clusterDetails[0].cluster);
    }
  }, [clusterDetails, selectedClusterId]);

  const selectedCluster =
    clusterDetails.find((cluster) => cluster.cluster === selectedClusterId) ||
    clusterDetails[0] ||
    null;
  const selectedClusterProducts = selectedCluster?.products || [];
  const selectedClusterStores = selectedCluster?.stores || [];
  const selectedClusterBestModel = selectedCluster?.best_model_segment || null;
  const selectedClusterTopProduct = selectedCluster?.top_product || null;
  const selectedClusterChartRows = (selectedCluster?.daily || []).map((row) => {
    const nextRow = { ...row };
    selectedClusterProducts.forEach((product) => {
      nextRow[getChartDataKey(product.product)] = row.product_forecasts?.[product.product] || 0;
    });
    return nextRow;
  });

  return (
    <>
      <div className="panel-grid cols-3">
        <StatCard
          icon="FD"
          label="Total Forecast"
          value={formatNumber(forecastTotal)}
          meta={hasForecastSeries ? `${forecastPredictions.meta?.future_date_start} s/d ${forecastPredictions.meta?.future_date_end}` : `${viewPeriods} hari hasil ramalan`}
          toneClass="tonal-blue"
        />
        <StatCard
          icon="TK"
          label="Shipment Toko"
          value={formatNumber(shipmentTotal)}
          meta={hasForecastSeries ? `${formatNumber(summary.store_count || 0)} toko | ${formatNumber(summary.route_count || 0)} rute` : fallbackLabel}
          toneClass="tonal-green"
        />
        <StatCard
          icon="ML"
          label="Sumber Forecast"
          value={formatNumber(summary.model_count || 0)}
          meta={hasForecastSeries ? forecastPredictions.meta?.source_table || forecastPredictions.meta?.source || "PostgreSQL" : fallbackLabel}
          toneClass="tonal-orange"
        />
      </div>

      <Card
        title="Alur Dashboard Berbasis Cluster"
        subtitle="Pilih cluster untuk melihat forecast terbaik, produk dominan, dan toko yang termasuk di cluster tersebut."
        style={{ marginTop: 16 }}
      >
        {clusterDetails.length ? (
          <div className="cluster-selector-grid">
            {clusterDetails.map((cluster, index) => {
              const isActive = (selectedCluster?.cluster || selectedClusterId) === cluster.cluster;
              return (
                <button
                  key={cluster.cluster}
                  type="button"
                  className={`cluster-option-card ${isActive ? "is-active" : ""}`}
                  onClick={() => setSelectedClusterId(cluster.cluster)}
                >
                  <span className="cluster-option-top">
                    <strong>{cluster.cluster}</strong>
                    <span style={{ color: getWorkCenterColor(index) }}>{formatNumber(cluster.store_count)} toko</span>
                  </span>
                  <span className="cluster-option-value">{formatNumber(cluster.total_forecast_pcs, { maximumFractionDigits: 1 })} pcs</span>
                  <span className="helper-text">
                    Model: {cluster.best_model_segment?.model || "-"} | Produk: {cluster.top_product?.product || "-"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="inline-note">Belum ada cluster forecast dari PostgreSQL.</div>
        )}
      </Card>

      {selectedCluster ? (
        <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
          <Card
            title={`Chart Forecasted Demand ${selectedCluster.cluster}`}
            subtitle="Garis total menunjukkan demand cluster; garis produk menunjukkan forecasted demand setiap kategori produk."
          >
            <div className="footer-strip" style={{ marginTop: 0, marginBottom: 14 }}>
              <span className="metric-pill">
                Total forecast: <strong>{formatNumber(selectedCluster.total_forecast_pcs, { maximumFractionDigits: 1 })}</strong>
              </span>
              <span className="metric-pill">
                Total alokasi toko: <strong>{formatNumber(selectedCluster.total_shipment_pcs)}</strong>
              </span>
              <span className="metric-pill">
                Rute: <strong>{formatNumber(selectedCluster.route_count)}</strong>
              </span>
            </div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={selectedClusterChartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                  <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="total_forecast_pcs" name="Total Cluster" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
                  {selectedClusterProducts.map((product, index) => (
                    <Line
                      key={product.product}
                      type="monotone"
                      dataKey={getChartDataKey(product.product)}
                      name={product.product}
                      stroke={getWorkCenterColor(index + 1)}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            title={`Forecast Terbaik ${selectedCluster.cluster}`}
            subtitle="Model terbaik memakai RMSE terendah; produk dominan memakai total forecast terbesar."
          >
            <div className="cluster-insight-grid">
              <div className="cluster-insight-box">
                <span>Model Terbaik</span>
                <strong>{selectedClusterBestModel?.model || "-"}</strong>
                <p>
                  {selectedClusterBestModel
                    ? `${selectedClusterBestModel.product} | RMSE ${formatNumber(selectedClusterBestModel.rmse, { maximumFractionDigits: 2 })} | R2 ${formatNumber(selectedClusterBestModel.r2, { maximumFractionDigits: 4 })}`
                    : "Belum ada evaluasi model."}
                </p>
              </div>
              <div className="cluster-insight-box">
                <span>Forecast Dominan</span>
                <strong>{selectedClusterTopProduct?.product || "-"}</strong>
                <p>
                  {selectedClusterTopProduct
                    ? `${formatNumber(selectedClusterTopProduct.total_forecast_pcs, { maximumFractionDigits: 1 })} pcs | ${selectedClusterTopProduct.model}`
                    : "Belum ada produk dominan."}
                </p>
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Model</th>
                    <th className="right">Forecast</th>
                    <th className="right">RMSE</th>
                    <th className="right">R2</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClusterProducts.map((product) => (
                    <tr key={product.product}>
                      <td><strong>{product.product}</strong></td>
                      <td>{product.model}</td>
                      <td className="right tonal-blue">{formatNumber(product.total_forecast_pcs, { maximumFractionDigits: 1 })}</td>
                      <td className="right tonal-green">{formatNumber(product.rmse, { maximumFractionDigits: 2 })}</td>
                      <td className="right tonal-purple">{formatNumber(product.r2, { maximumFractionDigits: 4 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {selectedCluster ? (
        <Card
          title={`Toko dalam ${selectedCluster.cluster}`}
          subtitle="Daftar toko tujuan hasil alokasi top-down pada cluster yang dipilih."
          style={{ marginTop: 16 }}
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Toko</th>
                  <th>Rute</th>
                  <th className="right">Produk</th>
                  <th className="right">Qty Kirim</th>
                </tr>
              </thead>
              <tbody>
                {selectedClusterStores.map((store) => (
                  <tr key={`${selectedCluster.cluster}-${store.id_toko}`}>
                    <td>
                      <strong>{store.id_toko}</strong>
                      <div className="helper-text">{store.nama_toko}</div>
                    </td>
                    <td>
                      <strong>{store.id_rute}</strong>
                      <div className="helper-text">{store.nama_rute}</div>
                    </td>
                    <td className="right">{formatNumber(store.product_count)}</td>
                    <td className="right tonal-green">
                      <strong>{formatNumber(store.total_shipment_pcs)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="panel-grid cols-4" style={{ marginTop: 16 }}>
        <StatCard
          icon="MAE"
          label="MAE"
          value={metricValue(overallMetrics.mae)}
          meta="KPI error absolut model"
          toneClass="tonal-blue"
        />
        <StatCard
          icon="MSE"
          label="MSE"
          value={metricValue(overallMetrics.mse)}
          meta="KPI error kuadrat model"
          toneClass="tonal-orange"
        />
        <StatCard
          icon="RM"
          label="RMSE"
          value={metricValue(overallMetrics.rmse)}
          meta={`${formatNumber(overallMetrics.sample_size || 0)} sampel evaluasi`}
          toneClass="tonal-green"
        />
        <StatCard
          icon="R2"
          label="R Square"
          value={metricValue(overallMetrics.r2, { maximumFractionDigits: 4 })}
          meta={bestModel ? `Terbaik: ${bestModel.model}` : "Menunggu evaluasi"}
          toneClass="tonal-purple"
        />
      </div>

      {forecastError ? (
        <div className="inline-note" style={{ marginTop: 16 }}>
          Forecast mengembalikan pesan: <strong>{forecastError}</strong>
        </div>
      ) : null}

      <Card
        title="Hasil Ramalan Permintaan"
        subtitle={algorithmLabel}
        extra={
          <button className="chip-button is-active" type="button" onClick={onRefreshForecast} disabled={forecastLoading}>
            {forecastLoading ? "Memuat..." : "Refresh Forecast"}
          </button>
        }
        style={{ marginTop: 16 }}
      >
        {hasForecastSeries ? (
          <div className="footer-strip" style={{ marginTop: 0, marginBottom: 14 }}>
            <span className="metric-pill">
              Sumber: <strong>{forecastPredictions.meta?.source_table || forecastPredictions.meta?.package_name}</strong>
            </span>
            <span className="metric-pill">
              Raw rows: <strong>{formatNumber(forecastPredictions.meta?.raw_data_rows || 0)}</strong>
            </span>
            <span className="metric-pill">
              Smoothed rows: <strong>{formatNumber(forecastPredictions.meta?.smoothed_rows || 0)}</strong>
            </span>
          </div>
        ) : null}
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
              <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend />
              <Line type="monotone" dataKey="total_forecast_pcs" name="Forecast Cluster" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="total_shipment_pcs" name="Alokasi Toko" stroke="#34d399" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
        <Card
          title="KPI Halaman Permintaan"
          subtitle="KRA, KPI, dan parameter mengikuti Coret2 untuk modul ramalan permintaan."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>KRA</th>
                  <th>KPI</th>
                  <th>Parameter</th>
                </tr>
              </thead>
              <tbody>
                {demandKpis.map((item) => (
                  <tr key={`${item.kra}-${item.indicator}`}>
                    <td><strong>{item.kra}</strong></td>
                    <td>{item.indicator}</td>
                    <td>{(item.parameters || []).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Perbandingan Model Peramalan"
          subtitle={evaluation.method || "Metrik evaluasi model dari backend forecast."}
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Model</th>
                  <th className="right">MAE</th>
                  <th className="right">RMSE</th>
                  <th className="right">R2</th>
                </tr>
              </thead>
              <tbody>
                {modelComparison.length ? (
                  modelComparison.map((row) => (
                    <tr key={row.model}>
                      <td>{row.rank}</td>
                      <td>
                        <strong>{row.model}</strong>
                        <div className="helper-text">{row.status} | {formatNumber(row.segment_count)} segmen</div>
                      </td>
                      <td className="right tonal-blue">{formatNumber(row.mae, { maximumFractionDigits: 2 })}</td>
                      <td className="right tonal-green">{formatNumber(row.rmse, { maximumFractionDigits: 2 })}</td>
                      <td className="right tonal-purple">{formatNumber(row.r2, { maximumFractionDigits: 4 })}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td>-</td>
                    <td>Belum ada evaluasi model</td>
                    <td className="right">-</td>
                    <td className="right">-</td>
                    <td className="right">-</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
        <Card
          title="Forecast per Produk"
          subtitle="Output forecast per kategori produk roti berdasarkan PostgreSQL."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th className="right">Forecast</th>
                  <th className="right">Alokasi Toko</th>
                  <th className="right">Model</th>
                </tr>
              </thead>
              <tbody>
                {productRows.map((row, index) => (
                  <tr key={row.product || row.id}>
                    <td>
                      <span className="product-tag">
                        <span className="product-dot" style={{ background: row.color || getWorkCenterColor(index) }} />
                        {row.product_name || row.product}
                      </span>
                    </td>
                    <td className="right tonal-blue">
                      <strong>{formatNumber(row.total_forecast_pcs, { maximumFractionDigits: 1 })}</strong>
                    </td>
                    <td className="right tonal-green">{formatNumber(row.total_shipment_pcs)}</td>
                    <td className="right">{row.model_count ? formatNumber(row.model_count) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Forecast per Cluster"
          subtitle="Agregasi output Forecast_Cluster dari PostgreSQL."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cluster</th>
                  <th className="right">Forecast</th>
                  <th className="right">Produk</th>
                </tr>
              </thead>
              <tbody>
                {clusterRows.length ? (
                  clusterRows.map((row) => (
                    <tr key={row.cluster}>
                      <td>{row.cluster}</td>
                      <td className="right tonal-blue">
                        <strong>{formatNumber(row.total_forecast_pcs, { maximumFractionDigits: 1 })}</strong>
                      </td>
                      <td className="right">{formatNumber(row.product_count)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td>Belum ada output cluster PostgreSQL</td>
                    <td className="right">-</td>
                    <td className="right">-</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
        <Card
          title="Top Toko Forecast"
          subtitle="Alokasi top-down dari Forecast_Toko, diurutkan dari jumlah kirim terbesar."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Toko</th>
                  <th>Rute</th>
                  <th className="right">Qty Kirim</th>
                </tr>
              </thead>
              <tbody>
                {storeRows.map((row) => (
                  <tr key={row.id_toko}>
                    <td>
                      <strong>{row.id_toko}</strong>
                      <div className="helper-text">{row.nama_toko}</div>
                    </td>
                    <td>{row.id_rute}</td>
                    <td className="right tonal-green">
                      <strong>{formatNumber(row.total_shipment_pcs)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Produk per Toko Tujuan"
          subtitle="KPI prediksi permintaan per produk roti dan toko tujuan."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Toko</th>
                  <th>Produk/Kategori</th>
                  <th>Rute</th>
                  <th className="right">Qty Kirim</th>
                </tr>
              </thead>
              <tbody>
                {storeProductRows.length ? (
                  storeProductRows.map((row) => (
                    <tr key={`${row.id_toko}-${row.product}-${row.id_rute}`}>
                      <td>
                        <strong>{row.id_toko}</strong>
                        <div className="helper-text">{row.nama_toko}</div>
                      </td>
                      <td>{row.product}</td>
                      <td>{row.id_rute}</td>
                      <td className="right tonal-green">
                        <strong>{formatNumber(row.total_shipment_pcs)}</strong>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td>Belum ada alokasi toko-produk</td>
                    <td>-</td>
                    <td>-</td>
                    <td className="right">-</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card
        title="Alokasi per Rute"
        subtitle="Rekap rute distribusi dari output toko hasil package."
        style={{ marginTop: 16 }}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rute</th>
                <th>Nama Rute</th>
                <th className="right">Toko</th>
                <th className="right">Qty Kirim</th>
              </tr>
            </thead>
            <tbody>
              {routeRows.map((row) => (
                <tr key={row.id_rute}>
                  <td><strong>{row.id_rute}</strong></td>
                  <td>{row.nama_rute}</td>
                  <td className="right">{formatNumber(row.store_count)}</td>
                  <td className="right tonal-green">
                    <strong>{formatNumber(row.total_shipment_pcs)}</strong>
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

function MaterialOrderReportPage({ mrp }) {
  const rawMaterials = (mrp.items_by_category?.raw_material || [])
    .filter(hasMrpMaterialActivity)
    .map((item) => {
      const orderQuantity = Number(item.total_planned_order_release || item.total_net_requirement || 0);
      const pricing = getMaterialPricing(item);
      const unitCost = getMaterialUnitCost(item);
      return {
        ...item,
        orderQuantity,
        pricing,
        unitCost,
        estimatedCost: orderQuantity * unitCost,
      };
    });
  const totalEstimatedCost = rawMaterials.reduce((sum, item) => sum + item.estimatedCost, 0);
  const highestCostItem = rawMaterials.reduce(
    (highest, item) => (item.estimatedCost > (highest?.estimatedCost || 0) ? item : highest),
    rawMaterials[0] || null,
  );

  return (
    <>
      <div className="panel-grid cols-4">
        <StatCard
          icon="BB"
          label="Bahan Baku"
          value={formatNumber(rawMaterials.length)}
          meta="Item untuk laporan pemesanan"
          toneClass="tonal-orange"
        />
        <StatCard
          icon="GR"
          label="Gross Requirement"
          value={formatNumber(rawMaterials.reduce((sum, item) => sum + (item.total_gross_requirement || 0), 0))}
          meta="Total kebutuhan kotor"
          toneClass="tonal-blue"
        />
        <StatCard
          icon="PO"
          label="Planned Order Release"
          value={formatNumber(rawMaterials.reduce((sum, item) => sum + (item.total_planned_order_release || 0), 0))}
          meta="Total rencana pemesanan"
          toneClass="tonal-green"
        />
        <StatCard
          icon="Rp"
          label="Estimasi Biaya"
          value={formatCurrency(totalEstimatedCost)}
          meta={highestCostItem ? `Tertinggi: ${highestCostItem.name}` : "Belum ada biaya"}
          toneClass="tonal-purple"
        />
      </div>

      <Card
        title="Laporan Pemesanan Bahan Baku"
        subtitle="Rekap kuantitas pemesanan beserta estimasi biaya bahan baku yang keluar dari biaya produksi."
        style={{ marginTop: 16 }}
      >
        <div className="footer-strip" style={{ marginTop: 0, marginBottom: 14 }}>
          <span className="metric-pill">
            Total estimasi biaya produksi: <strong>{formatCurrency(totalEstimatedCost)}</strong>
          </span>
          <span className="metric-pill">
            Rata-rata biaya per item: <strong>{formatCurrency(totalEstimatedCost / Math.max(1, rawMaterials.length))}</strong>
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Bahan Baku</th>
                <th className="center">Lot Size</th>
                <th className="center">Lead Time</th>
                <th className="right">Gross Req</th>
                <th className="right">Net Req</th>
                <th className="right">PORel</th>
                <th className="right">Harga Referensi</th>
                <th className="right">Estimasi Biaya</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.map((item) => (
                <tr key={item.id}>
                  <td className="tonal-orange">
                    <strong>{item.code || item.id}</strong>
                  </td>
                  <td>{item.name}</td>
                  <td className="center">{formatLotSize(item.lot_size)}</td>
                  <td className="center">{formatNumber(item.lead_time)}</td>
                  <td className="right">{formatNumber(item.total_gross_requirement)}</td>
                  <td className="right tonal-blue">{formatNumber(item.total_net_requirement)}</td>
                  <td className="right tonal-green">
                    <strong>{formatNumber(item.total_planned_order_release)}</strong>
                  </td>
                  <td className="right">
                    <strong>{formatCurrency(item.pricing.packagePrice)}</strong>
                    <div className="helper-text">
                      per {formatNumber(item.pricing.packageSize, { maximumFractionDigits: 3 })} {item.pricing.packageUnit}
                    </div>
                  </td>
                  <td className="right tonal-purple">
                    <strong>{formatCurrency(item.estimatedCost)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inline-note">
          Harga bahan baku mengikuti data master bahan baku PostgreSQL. Estimasi biaya dihitung proporsional terhadap satuan pakai BOM.
        </div>
      </Card>
    </>
  );
}

function BillOfMaterialPage({ billOfMaterial }) {
  const rows = billOfMaterial?.rows || [];
  const products = billOfMaterial?.products || [];
  const activeProducts = products.filter((product) => product.component_count > 0);

  return (
    <>
      <div className="panel-grid cols-3">
        <StatCard
          icon="BOM"
          label="Produk BOM"
          value={formatNumber(billOfMaterial?.product_count || 0)}
          meta="Produk final dari PostgreSQL"
          toneClass="tonal-blue"
        />
        <StatCard
          icon="LIN"
          label="Baris BOM"
          value={formatNumber(billOfMaterial?.line_count || 0)}
          meta="Komponen aktif"
          toneClass="tonal-green"
        />
        <StatCard
          icon="BB"
          label="Bahan Unik"
          value={formatNumber(billOfMaterial?.component_count || 0)}
          meta={billOfMaterial?.source || "PostgreSQL BOM"}
          toneClass="tonal-orange"
        />
      </div>

      <Card
        title="Halaman Bill of Material"
        subtitle="Output kebutuhan bahan baku per produk roti dari database."
        style={{ marginTop: 16 }}
      >
        <div className="inline-note">{billOfMaterial?.policy || "BOM ditampilkan sebagai output perencanaan produksi."}</div>

        {activeProducts.length ? (
          <div className="panel-grid cols-3" style={{ marginTop: 16 }}>
            {activeProducts.map((product) => (
              <div className="bom-product-card" key={product.id} style={{ borderColor: `${product.color || "#38bdf8"}44` }}>
                <div className="route-head">
                  <div>
                    <div className="route-id">{product.id}</div>
                    <div className="route-meta">{product.name}</div>
                  </div>
                  <span className="badge" style={{ background: `${product.color || "#38bdf8"}22`, color: product.color || "#38bdf8" }}>
                    {formatNumber(product.component_count)} komponen
                  </span>
                </div>
                <div className="stack-list">
                  {product.components.map((component) => (
                    <div className="bom-component-row" key={`${product.id}-${component.material_id}`}>
                      <span>{component.material_name}</span>
                      <strong>
                        {formatNumber(component.quantity_per_parent, { maximumFractionDigits: 3 })} {component.unit}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="inline-note" style={{ marginTop: 16 }}>
            Belum ada baris BOM aktif pada tabel PostgreSQL. Halaman ini disiapkan sebagai output, bukan form input data.
          </div>
        )}
      </Card>

      <Card
        title="Detail Bill of Material"
        subtitle="Daftar parent product, komponen, quantity per unit, dan scrap factor."
        style={{ marginTop: 16 }}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Komponen</th>
                <th className="right">Qty / Unit</th>
                <th>Unit</th>
                <th className="right">Scrap</th>
                <th>Versi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={`${row.product_id}-${row.material_id}-${row.line_no}`}>
                    <td>
                      <strong>{row.product_id}</strong>
                      <div className="helper-text">{row.product_name}</div>
                    </td>
                    <td>
                      <strong>{row.material_id}</strong>
                      <div className="helper-text">{row.material_name}</div>
                    </td>
                    <td className="right tonal-blue">
                      <strong>{formatNumber(row.quantity_per_parent, { maximumFractionDigits: 3 })}</strong>
                    </td>
                    <td>{row.unit || "-"}</td>
                    <td className="right">{formatPercent(row.scrap_factor_pct || 0)}</td>
                    <td>{row.version_code || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>Belum ada data BOM aktif.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StoreSegmentationPage({ routes, onNavigate }) {
  const routeRows = routes.routes || [];
  const totalStores = routeRows.reduce((sum, route) => sum + (route.store_count || 0), 0);

  return (
    <>
      <div className="panel-grid cols-3">
        <StatCard icon="SG" label="Segmen Rute" value={formatNumber(routeRows.length)} meta="Kelompok toko aktif" toneClass="tonal-blue" />
        <StatCard icon="TK" label="Total Toko" value={formatNumber(totalStores)} meta="Toko dalam rute distribusi" toneClass="tonal-green" />
        <StatCard icon="IN" label="Input Toko" value="Aktif" meta="Tersedia untuk pemasaran" toneClass="tonal-orange" />
      </div>

      <Card
        title="Hasil Segmentasi Toko"
        subtitle="Toko dikelompokkan berdasarkan rute distribusi dan area layanan."
        extra={
          <button type="button" className="chip-button is-active" onClick={() => onNavigate("input-store")}>
            Input Data Toko
          </button>
        }
        style={{ marginTop: 16 }}
      >
        <div className="panel-grid cols-3">
          {routeRows.map((route) => (
            <div className="route-card" key={route.id} style={{ borderColor: `${route.color}44` }}>
              <div className="route-head">
                <div>
                  <div className="route-id">{route.id}</div>
                  <div className="route-meta">{route.name}</div>
                </div>
                <span className="badge" style={{ background: `${route.color}22`, borderColor: `${route.color}44`, color: route.color }}>
                  {formatNumber(route.store_count)} toko
                </span>
              </div>
              <div className="route-stores">
                {(route.stores || []).slice(0, 5).map((store) => (
                  <div className="route-store" key={store.id} style={{ color: route.color }}>
                    <span>{store.name} | {store.location}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function DataHubPage({ title, subtitle, items, onNavigate }) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="data-hub-grid">
        {items.map((item) => (
          <button
            key={item.view}
            type="button"
            className="data-hub-button"
            onClick={() => onNavigate(item.view)}
          >
            <span>{item.label}</span>
            <strong>{item.meta}</strong>
          </button>
        ))}
      </div>
    </Card>
  );
}

function SupplierStoreDataPage({ routes, onNavigate }) {
  return (
    <>
      <DataHubPage
        title="Halaman Data Supplier dan Toko"
        subtitle="Menu input toko sesuai UI Tree karyawan pemasaran dan referensi rute distribusi."
        onNavigate={onNavigate}
        items={[
          { view: "input-store", label: "Input Data Toko", meta: "Toko" },
        ]}
      />
      <Card title="Data Toko per Rute" subtitle="Ringkasan toko dari master rute." style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rute</th>
                <th>Nama Rute</th>
                <th className="right">Jumlah Toko</th>
              </tr>
            </thead>
            <tbody>
              {(routes.routes || []).map((route) => (
                <tr key={route.id}>
                  <td className="tonal-blue"><strong>{route.id}</strong></td>
                  <td>{route.name}</td>
                  <td className="right">{formatNumber(route.store_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function InputDataPage({ view, currentUser, onNavigate }) {
  const definition = FORM_DEFINITIONS[view] || FORM_DEFINITIONS["input-product"];
  const emptyFormValues = useMemo(
    () => Object.fromEntries(definition.fields.map((field) => [field.name, ""])),
    [definition],
  );
  const [formValues, setFormValues] = useState(emptyFormValues);
  const [submitted, setSubmitted] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const emptyFields = definition.fields.filter((field) => !String(formValues[field.name] || "").trim());
  const emptyFieldNames = new Set(emptyFields.map((field) => field.name));
  const hasEmptyFields = emptyFields.length > 0;

  useEffect(() => {
    setFormValues(emptyFormValues);
    setSubmitted(false);
    setSavedAt(null);
  }, [emptyFormValues, view]);

  function handleFieldChange(fieldName, value) {
    setFormValues((previous) => ({
      ...previous,
      [fieldName]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    if (hasEmptyFields) {
      setSavedAt(null);
      return;
    }
    setSavedAt(new Date());
    setSubmitted(false);
    setFormValues(emptyFormValues);
  }

  function handleCancelInput() {
    const homeView = ROLE_PROFILES[currentUser.role]?.home || "owner-dashboard";
    onNavigate?.(homeView);
  }

  return (
    <Card title={definition.title} subtitle={definition.subtitle}>
      <div className={`input-reminder ${submitted && hasEmptyFields ? "is-warning" : ""}`}>
        <strong>Pengingat input data</strong>
        <span>
          Isi data sesuai label dan tipe kolom sebelum menekan Simpan Draft. Jika tidak jadi memasukkan data, form ini boleh ditinggalkan lewat menu atau tombol Batal Input.
        </span>
        {hasEmptyFields ? (
          <small>{formatNumber(emptyFields.length)} kolom masih kosong.</small>
        ) : (
          <small>Semua kolom sudah terisi.</small>
        )}
      </div>
      <form className="forecast-form" onSubmit={handleSubmit}>
        {definition.fields.map((field) => {
          const fieldIsEmpty = submitted && emptyFieldNames.has(field.name);
          return (
          <label className={`form-field ${fieldIsEmpty ? "has-error" : ""}`} key={field.name}>
            <span>
              {field.label}
              <small>Wajib</small>
            </span>
            <input
              name={field.name}
              type={field.type || "text"}
              step={field.step}
              placeholder={field.placeholder || ""}
              value={formValues[field.name] || ""}
              onChange={(event) => handleFieldChange(field.name, event.target.value)}
              aria-invalid={fieldIsEmpty}
            />
            {fieldIsEmpty ? <small className="field-error">Kolom ini belum boleh kosong.</small> : null}
          </label>
          );
        })}
        <div className="footer-strip">
          <button className="chip-button is-active" type="submit">
            Simpan Draft
          </button>
          <button className="chip-button" type="button" onClick={handleCancelInput}>
            Batal Input
          </button>
          <span className="metric-pill">
            Role input: <strong>{currentUser.department}</strong>
          </span>
          {submitted && hasEmptyFields ? (
            <span className="metric-pill warning-pill">
              Cek ulang: <strong>{formatNumber(emptyFields.length)} kolom kosong</strong>
            </span>
          ) : null}
          {savedAt ? (
            <span className="metric-pill">
              Tersimpan lokal: <strong>{formatClock(savedAt)}</strong>
            </span>
          ) : null}
        </div>
      </form>
      <div className="inline-note">
        Entity target: <strong>{definition.entity}</strong>. Form ini mengikuti atribut data dictionary; integrasi simpan ke database bisa diarahkan ke endpoint backend berikutnya.
      </div>
    </Card>
  );
}

function PasswordChangePage({ currentUser, onChangePassword, onNavigate }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsSuccess(false);
    if (newPassword !== confirmPassword) {
      setMessage("Konfirmasi password baru belum sama.");
      return;
    }

    setSubmitting(true);
    const result = await onChangePassword({
      userId: currentUser.id,
      username: currentUser.username,
      currentPassword,
      newPassword,
    });
    setSubmitting(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setIsSuccess(true);
    setMessage("Password berhasil diperbarui.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function handleCancel() {
    const homeView = ROLE_PROFILES[currentUser.role]?.home || "owner-dashboard";
    onNavigate?.(homeView);
  }

  return (
    <Card title="Ganti Password" subtitle="Perbarui password akun aktif sesuai role pengguna.">
      <div className="footer-strip" style={{ marginTop: 0, marginBottom: 14 }}>
        <span className="metric-pill">
          User: <strong>{currentUser.name}</strong>
        </span>
        <span className="metric-pill">
          Role: <strong>{currentUser.department}</strong>
        </span>
        <span className="metric-pill">
          Username: <strong>{currentUser.username}</strong>
        </span>
      </div>

      <form className="forecast-form password-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Password Lama</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label className="form-field">
          <span>Password Baru</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="form-field">
          <span>Konfirmasi Password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>

        {message ? (
          <div className={`inline-note form-message ${isSuccess ? "is-success" : "is-error"}`}>
            {message}
          </div>
        ) : null}

        <div className="footer-strip">
          <button className="chip-button is-active" type="submit" disabled={submitting}>
            {submitting ? "Memproses..." : "Simpan Password"}
          </button>
          <button className="chip-button" type="button" onClick={handleCancel}>
            Batal
          </button>
        </div>
      </form>
    </Card>
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
}) {
  const periods = withDayPeriodLabels(plan?.periods ?? []);
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
        {workCenters.map((workCenter, index) => {
          const visibleLoadValues = slicePeriodValues(workCenter.load_values || []);
          const peakPeriodIndex = (workCenter.load_values || []).findIndex((value) => value === Math.max(...(workCenter.load_values || [0])));
          return (
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
                Peak util: <strong>{formatPercent(workCenter.peak_utilization_pct)}</strong> di <strong>{getDayPeriodLabel(Math.max(0, peakPeriodIndex))}</strong>
              </div>
              <div className="metric-pill">
                Beban total: <strong>{formatMinutes(visibleLoadValues.reduce((sum, value) => sum + value, 0))}</strong>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
        <Card title={loadChartTitle} subtitle={loadChartSubtitle}>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={periods}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="total_load_minutes" name="Load (mnt/hari)" fill="#0891b2" radius={[8, 8, 0, 0]} />
                <Bar dataKey="total_available_minutes" name="Available Time (mnt/hari)" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={utilizationTitle} subtitle={utilizationSubtitle}>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={periods}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} unit="%" />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
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
        extra={<span className="badge">{viewPeriods} hari</span>}
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
                <th className="right">Avail/Hari</th>
              </tr>
            </thead>
            <tbody>
              {workCenters.map((workCenter) => (
                <tr key={workCenter.id}>
                  <td className="sticky-col">
                    <strong>{workCenter.id}</strong> | {workCenter.name}
                  </td>
                  {slicePeriodValues(workCenter.load_values || []).map((loadValue, index) => {
                    const availableValue = slicePeriodValues(workCenter.available_time_values || [])[index];
                    const isOverload = availableValue > 0 && loadValue > availableValue;
                    const isTight = availableValue > 0 && loadValue / availableValue > 0.8;
                    return (
                      <td
                        key={`${workCenter.id}-${index}`}
                        className="center"
                        style={{
                          color: isOverload ? "#be123c" : isTight ? "#b45309" : "#047857",
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
                      slicePeriodValues(workCenter.load_values || []).reduce((sum, value) => sum + value, 0) / (slicePeriodValues(workCenter.load_values || []).length || 1),
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

function PlannerWorkbench() {
  const [planner, setPlanner] = useState(() => loadPlannerState());
  const [selectedPlannerProductId, setSelectedPlannerProductId] = useState("");
  const algorithm = useMemo(() => buildPlannerAlgorithm(planner), [planner]);
  const plannerChartRows = useMemo(() => (
    algorithm.periods.map((period, index) => ({
      period: period.period,
      forecast: algorithm.forecast.rows.reduce((sum, row) => sum + (row.values[index] || 0), 0),
      mps: algorithm.mps.rows.reduce((sum, row) => sum + (row.values[index] || 0), 0),
      rccp_utilization: algorithm.rccp.periods[index]?.bottleneck_utilization_pct || 0,
      crp_utilization: algorithm.crp.periods[index]?.bottleneck_utilization_pct || 0,
    }))
  ), [algorithm]);
  const maxPlannerWeekTotal = Math.max(...algorithm.schedule.weeks.map((week) => week.total), 1);
  const selectedPlannerProduct =
    planner.products.find((product) => product.id === selectedPlannerProductId) ||
    planner.products[0] ||
    null;

  useEffect(() => {
    savePlannerState(planner);
  }, [planner]);

  useEffect(() => {
    if (!selectedPlannerProduct || selectedPlannerProduct.id !== selectedPlannerProductId) {
      setSelectedPlannerProductId(selectedPlannerProduct?.id || "");
    }
  }, [selectedPlannerProduct, selectedPlannerProductId]);

  function updatePlanner(updater) {
    setPlanner((previous) => updater(previous));
  }

  function updateSettings(field, value) {
    updatePlanner((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        [field]: value,
      },
    }));
  }

  function updateProduct(productId, field, value) {
    updatePlanner((previous) => ({
      ...previous,
      products: previous.products.map((product) => (
        product.id === productId ? { ...product, [field]: value } : product
      )),
    }));
  }

  function updateProductHistory(productId, historyIndex, value) {
    updatePlanner((previous) => ({
      ...previous,
      products: previous.products.map((product) => {
        if (product.id !== productId) {
          return product;
        }
        const nextHistory = [...(product.history || [0, 0, 0, 0])];
        nextHistory[historyIndex] = value;
        return { ...product, history: nextHistory };
      }),
    }));
  }

  function addProduct() {
    const id = makePlannerId("P", planner.products);
    const color = WC_COLORS[planner.products.length % WC_COLORS.length];
    const nextProduct = {
      id,
      name: `Produk ${planner.products.length + 1}`,
      active: true,
      lotSize: 10,
      safetyStock: 10,
      leadTimeWeeks: 1,
      history: [120, 130, 140, 150],
      color,
    };
    updatePlanner((previous) => ({
      ...previous,
      products: [...previous.products, nextProduct],
      routing: [
        ...previous.routing,
        ...previous.workCenters.map((workCenter) => ({
          productId: id,
          workCenterId: workCenter.id,
          minutesPerUnit: 0,
        })),
      ],
    }));
    setSelectedPlannerProductId(id);
  }

  function removeProduct(productId) {
    updatePlanner((previous) => ({
      ...previous,
      products: previous.products.filter((product) => product.id !== productId),
      bom: previous.bom.filter((entry) => entry.productId !== productId),
      routing: previous.routing.filter((entry) => entry.productId !== productId),
    }));
  }

  function updateMaterial(materialId, field, value) {
    updatePlanner((previous) => ({
      ...previous,
      materials: previous.materials.map((material) => (
        material.id === materialId ? { ...material, [field]: value } : material
      )),
    }));
  }

  function addMaterial() {
    updatePlanner((previous) => ({
      ...previous,
      materials: [
        ...previous.materials,
        {
          id: makePlannerId("RM", previous.materials),
          name: `Bahan ${previous.materials.length + 1}`,
          unit: "gr",
          onHand: 0,
          safetyStock: 0,
          lotSize: 1,
          leadTimeWeeks: 1,
          supplierId: previous.suppliers[0]?.id || "",
          packagePrice: 0,
          packageSize: 1,
          packageUnit: "gr",
          unitCost: 0,
        },
      ],
    }));
  }

  function removeMaterial(materialId) {
    updatePlanner((previous) => ({
      ...previous,
      materials: previous.materials.filter((material) => material.id !== materialId),
      bom: previous.bom.filter((entry) => entry.materialId !== materialId),
    }));
  }

  function updateSupplier(supplierId, field, value) {
    updatePlanner((previous) => ({
      ...previous,
      suppliers: previous.suppliers.map((supplier) => (
        supplier.id === supplierId ? { ...supplier, [field]: value } : supplier
      )),
    }));
  }

  function addSupplier() {
    updatePlanner((previous) => ({
      ...previous,
      suppliers: [
        ...previous.suppliers,
        {
          id: makePlannerId("SUP", previous.suppliers),
          name: `Supplier ${previous.suppliers.length + 1}`,
          leadTimeDays: 2,
          contact: "",
        },
      ],
    }));
  }

  function removeSupplier(supplierId) {
    updatePlanner((previous) => ({
      ...previous,
      suppliers: previous.suppliers.filter((supplier) => supplier.id !== supplierId),
      materials: previous.materials.map((material) => (
        material.supplierId === supplierId ? { ...material, supplierId: "" } : material
      )),
    }));
  }

  function updateBomQuantity(productId, materialId, value) {
    updatePlanner((previous) => {
      const quantity = Math.max(0, toPlannerNumber(value, 0));
      const existingEntries = previous.bom.filter((entry) => (
        !(entry.productId === productId && entry.materialId === materialId)
      ));
      return {
        ...previous,
        bom: quantity > 0
          ? [...existingEntries, { productId, materialId, quantity }]
          : existingEntries,
      };
    });
  }

  function updateRoutingMinutes(productId, workCenterId, value) {
    updatePlanner((previous) => {
      const minutesPerUnit = Math.max(0, toPlannerNumber(value, 0));
      const existingEntries = previous.routing.filter((entry) => (
        !(entry.productId === productId && entry.workCenterId === workCenterId)
      ));
      return {
        ...previous,
        routing: [
          ...existingEntries,
          { productId, workCenterId, minutesPerUnit },
        ],
      };
    });
  }

  function updateWorkCenter(workCenterId, field, value) {
    updatePlanner((previous) => ({
      ...previous,
      workCenters: previous.workCenters.map((workCenter) => (
        workCenter.id === workCenterId ? { ...workCenter, [field]: value } : workCenter
      )),
    }));
  }

  function resetPlanner() {
    setPlanner(normalizePlannerState(DEFAULT_PLANNER_STATE));
    setSelectedPlannerProductId(DEFAULT_PLANNER_STATE.products[0]?.id || "");
  }

  function renderWeekColumns(row, valuesKey = "values") {
    return algorithm.periods.map((period, index) => (
      <td key={`${row.id}-${period.period}`} className="right">
        {formatNumber(row[valuesKey]?.[index] || 0, { maximumFractionDigits: 2 })}
      </td>
    ));
  }

  function renderCapacityTable(plan, title, subtitle) {
    return (
      <Card title={title} subtitle={subtitle}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Work Center</th>
                <th className="right">Available</th>
                <th className="right">Peak Util</th>
                <th className="right">Avg Util</th>
              </tr>
            </thead>
            <tbody>
              {plan.work_centers.map((workCenter) => (
                <tr key={`${title}-${workCenter.id}`}>
                  <td>
                    <strong>{workCenter.id}</strong> | {workCenter.name}
                  </td>
                  <td className="right">{formatMinutes(workCenter.available_time_minutes)}</td>
                  <td className="right tonal-orange">
                    <strong>{formatPercent(workCenter.peak_utilization_pct)}</strong>
                  </td>
                  <td className="right tonal-blue">
                    <strong>{formatPercent(workCenter.average_utilization_pct)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="footer-strip">
          <span className="metric-pill">
            Total load puncak: <strong>{formatMinutes(Math.max(...plan.periods.map((period) => period.total_load_minutes), 0))}</strong>
          </span>
          <span className="metric-pill">
            Total available: <strong>{formatMinutes(plan.total_available_minutes)}</strong>
          </span>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="panel-grid cols-4">
        <StatCard
          icon="FD"
          label="Forecast Demand"
          value={formatNumber(algorithm.forecast.total)}
          meta={`${algorithm.settings.horizonWeeks} hari dari jumlah_laku`}
          toneClass="tonal-orange"
        />
        <StatCard
          icon="MPS"
          label="Total MPS"
          value={formatNumber(algorithm.mps.total)}
          meta={`Buffer ${(algorithm.settings.serviceBufferFactor * 100 - 100).toFixed(1)}%`}
          toneClass="tonal-blue"
        />
        <StatCard
          icon="MRP"
          label="Order Bahan"
          value={formatNumber(algorithm.mrp.totalPlannedOrderRelease, { maximumFractionDigits: 1 })}
          meta={`${formatNumber(planner.materials.length)} bahan baku aktif`}
          toneClass="tonal-green"
        />
        <StatCard
          icon="CRP"
          label="Peak CRP"
          value={algorithm.peakCapacity ? formatPercent(algorithm.peakCapacity.bottleneck_utilization_pct) : "0%"}
          meta={algorithm.peakCapacity?.bottleneck?.id ? `${algorithm.peakCapacity.bottleneck.id} | ${algorithm.peakCapacity.period}` : "Belum ada load"}
          toneClass="tonal-purple"
        />
      </div>

      <div className="footer-strip">
        <button className="chip-button" type="button" onClick={resetPlanner}>
          Reset Data Demo
        </button>
        <span className="metric-pill">
          Periode algoritma: <strong>{FIXED_PERIOD_DAYS} hari</strong>
        </span>
      </div>

      <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
        <Card
          title="Visual Forecast ke MPS"
          subtitle="Bar oranye adalah forecasted demand, bar biru adalah hasil lot sizing MPS."
        >
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={plannerChartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="forecast" name="Forecasted Demand" fill="#22d3ee" radius={[8, 8, 0, 0]} />
                <Bar dataKey="mps" name="MPS" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title="Visual Bottleneck RCCP dan CRP"
          subtitle="Garis menunjukkan utilisasi bottleneck tertinggi per hari."
        >
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={plannerChartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} unit="%" />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
                <Line type="monotone" dataKey="rccp_utilization" name="RCCP Bottleneck" stroke="#facc15" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="crp_utilization" name="CRP Bottleneck" stroke="#34d399" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card
        title="Visual Timeline Scheduling"
        subtitle="Panjang bar menunjukkan total produksi harian; teks bar mengikuti urutan produk dari algoritma CDS."
        style={{ marginTop: 16 }}
      >
        <div className="footer-strip" style={{ marginTop: 0, marginBottom: 14 }}>
          <span className="metric-pill">
            Algoritma: <strong>{algorithm.schedule.algorithm.name}</strong>
          </span>
          <span className="metric-pill">
            Kandidat/hari: <strong>{formatNumber(algorithm.schedule.weeks[0]?.cds?.candidate_count || 0)}</strong>
          </span>
        </div>
        <div className="schedule-visual-list">
          {algorithm.schedule.weeks.map((week) => (
            <div className="schedule-visual-row" key={`visual-${week.period}`}>
              <div className="schedule-visual-label">
                <strong>{week.period}</strong>
                <span>{formatNumber(week.total)} pcs</span>
              </div>
              <div className="schedule-visual-track">
                <div
                  className="schedule-visual-bar"
                  style={{
                    width: `${Math.max(6, (week.total / maxPlannerWeekTotal) * 100)}%`,
                    background: `linear-gradient(90deg, ${week.status.color}, rgba(56,189,248,0.72))`,
                  }}
                >
                  {week.cds?.sequence_label || week.products.slice(0, 3).map((product) => product.name).join(", ")}
                </div>
              </div>
              <div className="schedule-visual-status">
                <StatusLabel status={week.status} />
                <span>{week.bottleneck?.id || "-"} {formatPercent(week.bottleneck?.utilization_pct || 0)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Parameter Forecasted Demand"
        subtitle="Jumlah_laku historis menjadi input utama forecast, lalu diteruskan ke MPS."
        style={{ marginTop: 16 }}
      >
        <div className="forecast-form">
          <label className="form-field">
            <span>Horizon Planning (hari)</span>
            <input
              type="number"
              min="1"
              max={FIXED_PERIOD_DAYS}
              value={FIXED_PERIOD_DAYS}
              readOnly
            />
          </label>
          <label className="form-field">
            <span>Moving Average</span>
            <input
              type="number"
              min="1"
              max="4"
              value={planner.settings.movingAveragePeriods}
              onChange={(event) => updateSettings("movingAveragePeriods", event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Growth Demand (%)</span>
            <input
              type="number"
              min="-50"
              max="200"
              value={planner.settings.growthPercent}
              onChange={(event) => updateSettings("growthPercent", event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Buffer MPS (%)</span>
            <input
              type="number"
              min="0"
              max="200"
              value={planner.settings.serviceBufferPercent}
              onChange={(event) => updateSettings("serviceBufferPercent", event.target.value)}
            />
          </label>
        </div>
      </Card>

      <Card
        title="Produk Roti dan Quantity Laku"
        subtitle="Produk bisa ditambah, dinonaktifkan, atau dihapus. Kolom W-4 sampai W-1 dipakai sebagai histori laku."
        extra={
          <button className="chip-button is-active" type="button" onClick={addProduct}>
            Tambah Produk
          </button>
        }
        style={{ marginTop: 16 }}
      >
        <div className="table-wrap">
          <table className="data-table planner-edit-table">
            <thead>
              <tr>
                <th>Aktif</th>
                <th>Produk</th>
                <th className="right">W-4</th>
                <th className="right">W-3</th>
                <th className="right">W-2</th>
                <th className="right">W-1</th>
                <th className="right">Lot</th>
                <th className="right">SS</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {planner.products.map((product) => (
                <tr key={product.id}>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={product.active !== false}
                      onChange={(event) => updateProduct(product.id, "active", event.target.checked)}
                    />
                  </td>
                  <td>
                    <div className="planner-product-cell">
                      <span className="product-dot" style={{ background: product.color }} />
                      <input
                        className="compact-input"
                        value={product.name}
                        onChange={(event) => updateProduct(product.id, "name", event.target.value)}
                      />
                    </div>
                    <div className="helper-text">{product.id}</div>
                  </td>
                  {[0, 1, 2, 3].map((historyIndex) => (
                    <td className="right" key={`${product.id}-history-${historyIndex}`}>
                      <input
                        className="compact-input numeric"
                        type="number"
                        min="0"
                        value={product.history?.[historyIndex] ?? 0}
                        onChange={(event) => updateProductHistory(product.id, historyIndex, event.target.value)}
                      />
                    </td>
                  ))}
                  <td className="right">
                    <input
                      className="compact-input numeric"
                      type="number"
                      min="1"
                      value={product.lotSize}
                      onChange={(event) => updateProduct(product.id, "lotSize", event.target.value)}
                    />
                  </td>
                  <td className="right">
                    <input
                      className="compact-input numeric"
                      type="number"
                      min="0"
                      value={product.safetyStock}
                      onChange={(event) => updateProduct(product.id, "safetyStock", event.target.value)}
                    />
                  </td>
                  <td>
                    <button className="chip-button danger-button" type="button" onClick={() => removeProduct(product.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
        <Card
          title="Bahan Baku"
          subtitle="Master bahan baku untuk BOM dan MRP."
          extra={
            <button className="chip-button is-active" type="button" onClick={addMaterial}>
              Tambah Bahan
            </button>
          }
        >
          <div className="table-wrap">
            <table className="data-table planner-edit-table">
              <thead>
                <tr>
                  <th>Bahan</th>
                  <th>Unit</th>
                  <th className="right">Harga Referensi</th>
                  <th className="right">Stok</th>
                  <th className="right">SS</th>
                  <th className="right">Lot</th>
                  <th className="right">LT</th>
                  <th>Supplier</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {planner.materials.map((material) => {
                  const pricing = getMaterialPricing(material);
                  return (
                    <tr key={material.id}>
                      <td>
                        <input
                          className="compact-input"
                          value={material.name}
                          onChange={(event) => updateMaterial(material.id, "name", event.target.value)}
                        />
                        <div className="helper-text">{material.id}</div>
                      </td>
                      <td>
                        <input
                          className="compact-input unit"
                          value={material.unit}
                          onChange={(event) => updateMaterial(material.id, "unit", event.target.value)}
                        />
                      </td>
                      <td className="right">
                        <strong>{formatCurrency(pricing.packagePrice)}</strong>
                        <div className="helper-text">
                          per {formatNumber(pricing.packageSize, { maximumFractionDigits: 3 })} {pricing.packageUnit}
                        </div>
                      </td>
                      <td className="right">
                        <input
                          className="compact-input numeric"
                          type="number"
                          min="0"
                          value={material.onHand}
                          onChange={(event) => updateMaterial(material.id, "onHand", event.target.value)}
                        />
                      </td>
                      <td className="right">
                        <input
                          className="compact-input numeric"
                          type="number"
                          min="0"
                          value={material.safetyStock}
                          onChange={(event) => updateMaterial(material.id, "safetyStock", event.target.value)}
                        />
                      </td>
                      <td className="right">
                        <input
                          className="compact-input numeric"
                          type="number"
                          min="0"
                          value={material.lotSize}
                          onChange={(event) => updateMaterial(material.id, "lotSize", event.target.value)}
                        />
                      </td>
                      <td className="right">
                        <input
                          className="compact-input numeric"
                          type="number"
                          min="0"
                          value={material.leadTimeWeeks}
                          onChange={(event) => updateMaterial(material.id, "leadTimeWeeks", event.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="compact-input supplier"
                          value={material.supplierId}
                          onChange={(event) => updateMaterial(material.id, "supplierId", event.target.value)}
                        >
                          <option value="">-</option>
                          {planner.suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button className="chip-button danger-button" type="button" onClick={() => removeMaterial(material.id)}>
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Supplier Bahan Baku"
          subtitle="Supplier dipilih dari master bahan baku dan ikut terbawa ke planned order release MRP."
          extra={
            <button className="chip-button is-active" type="button" onClick={addSupplier}>
              Tambah Supplier
            </button>
          }
        >
          <div className="table-wrap">
            <table className="data-table planner-edit-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th className="right">Lead Time</th>
                  <th>Kontak</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {planner.suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <input
                        className="compact-input"
                        value={supplier.name}
                        onChange={(event) => updateSupplier(supplier.id, "name", event.target.value)}
                      />
                      <div className="helper-text">{supplier.id}</div>
                    </td>
                    <td className="right">
                      <input
                        className="compact-input numeric"
                        type="number"
                        min="0"
                        value={supplier.leadTimeDays}
                        onChange={(event) => updateSupplier(supplier.id, "leadTimeDays", event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="compact-input"
                        value={supplier.contact}
                        onChange={(event) => updateSupplier(supplier.id, "contact", event.target.value)}
                      />
                    </td>
                    <td>
                      <button className="chip-button danger-button" type="button" onClick={() => removeSupplier(supplier.id)}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
        <Card
          title="Kebutuhan Bahan Baku per Produk"
          subtitle="Nilai BOM dihitung sebagai kebutuhan bahan baku per satu unit produk roti."
          extra={
            <select
              className="compact-input supplier"
              value={selectedPlannerProduct?.id || ""}
              onChange={(event) => setSelectedPlannerProductId(event.target.value)}
            >
              {planner.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          }
        >
          <div className="table-wrap">
            <table className="data-table planner-edit-table">
              <thead>
                <tr>
                  <th>Bahan</th>
                  <th>Supplier</th>
                  <th className="right">Qty / Unit</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {planner.materials.map((material) => (
                  <tr key={`${selectedPlannerProduct?.id}-${material.id}`}>
                    <td>{material.name}</td>
                    <td>{planner.suppliers.find((supplier) => supplier.id === material.supplierId)?.name || "-"}</td>
                    <td className="right">
                      <input
                        className="compact-input numeric"
                        type="number"
                        min="0"
                        step="0.01"
                        value={getPlannerBomQuantity(planner, selectedPlannerProduct?.id, material.id)}
                        onChange={(event) => updateBomQuantity(selectedPlannerProduct?.id, material.id, event.target.value)}
                      />
                    </td>
                    <td>{material.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Routing dan Kapasitas Work Center"
          subtitle="Routing per produk dipakai untuk RCCP kasar dan CRP detail."
        >
          <div className="table-wrap">
            <table className="data-table planner-edit-table">
              <thead>
                <tr>
                  <th>Work Center</th>
                  <th className="right">Available</th>
                  <th className="right">Setup</th>
                  <th className="right">Menit / Unit</th>
                </tr>
              </thead>
              <tbody>
                {planner.workCenters.map((workCenter) => (
                  <tr key={`${selectedPlannerProduct?.id}-${workCenter.id}`}>
                    <td>
                      <strong>{workCenter.id}</strong> | {workCenter.name}
                    </td>
                    <td className="right">
                      <input
                        className="compact-input numeric"
                        type="number"
                        min="1"
                        value={workCenter.availableMinutes}
                        onChange={(event) => updateWorkCenter(workCenter.id, "availableMinutes", event.target.value)}
                      />
                    </td>
                    <td className="right">
                      <input
                        className="compact-input numeric"
                        type="number"
                        min="0"
                        value={workCenter.setupMinutes}
                        onChange={(event) => updateWorkCenter(workCenter.id, "setupMinutes", event.target.value)}
                      />
                    </td>
                    <td className="right">
                      <input
                        className="compact-input numeric"
                        type="number"
                        min="0"
                        step="0.01"
                        value={getPlannerRoutingMinutes(planner, selectedPlannerProduct?.id, workCenter.id)}
                        onChange={(event) => updateRoutingMinutes(selectedPlannerProduct?.id, workCenter.id, event.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card
        title="Output Forecasted Demand dan MPS"
        subtitle="Setiap sel menampilkan forecast / MPS agar perubahan jumlah_laku terlihat langsung."
        style={{ marginTop: 16 }}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sticky-col">Produk</th>
                <th className="right">Avg Laku</th>
                {algorithm.periods.map((period) => (
                  <th key={`fd-mps-${period.period}`} className="right">
                    {period.period}
                  </th>
                ))}
                <th className="right">Total MPS</th>
              </tr>
            </thead>
            <tbody>
              {algorithm.forecast.rows.map((forecastRow) => {
                const mpsRow = algorithm.mps.rows.find((row) => row.id === forecastRow.id) || {};
                return (
                  <tr key={`fd-row-${forecastRow.id}`}>
                    <td className="sticky-col">
                      <span className="product-tag">
                        <span className="product-dot" style={{ background: forecastRow.color }} />
                        <strong>{forecastRow.name}</strong>
                      </span>
                    </td>
                    <td className="right tonal-blue">{formatNumber(forecastRow.baseDemand, { maximumFractionDigits: 1 })}</td>
                    {algorithm.periods.map((period, index) => (
                      <td key={`${forecastRow.id}-${period.period}`} className="right">
                        {formatNumber(forecastRow.values[index])} / <strong>{formatNumber(mpsRow.values?.[index] || 0)}</strong>
                      </td>
                    ))}
                    <td className="right tonal-orange">
                      <strong>{formatNumber(mpsRow.total || 0)}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Bridge Forecast, Produksi, dan Penjualan"
        subtitle="Forecasted demand menjadi target MPS; output produksi menambah stok barang jadi; penjualan dibatasi oleh demand dan stok tersedia."
        style={{ marginTop: 16 }}
      >
        <div className="footer-strip" style={{ marginTop: 0, marginBottom: 14 }}>
          <span className="metric-pill">
            Demand: <strong>{formatNumber(algorithm.sales.totalDemand)}</strong>
          </span>
          <span className="metric-pill">
            Produksi: <strong>{formatNumber(algorithm.sales.totalProduction)}</strong>
          </span>
          <span className="metric-pill">
            Penjualan terpenuhi: <strong>{formatNumber(algorithm.sales.totalSales)}</strong>
          </span>
          <span className="metric-pill">
            Service level: <strong>{formatPercent(algorithm.sales.fulfillmentRatePct)}</strong>
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th className="right">Forecast Demand</th>
                <th className="right">Produksi MPS</th>
                <th className="right">Estimasi Laku</th>
                <th className="right">Lost Sales</th>
                <th className="right">Stok Akhir</th>
                <th className="right">Service Level</th>
              </tr>
            </thead>
            <tbody>
              {algorithm.sales.rows.map((row) => (
                <tr key={`sales-bridge-${row.id}`}>
                  <td>
                    <span className="product-tag">
                      <span className="product-dot" style={{ background: row.color }} />
                      <strong>{row.name}</strong>
                    </span>
                  </td>
                  <td className="right">{formatNumber(row.totalDemand)}</td>
                  <td className="right tonal-blue">{formatNumber(row.totalProduction)}</td>
                  <td className="right tonal-green">
                    <strong>{formatNumber(row.totalSales)}</strong>
                  </td>
                  <td className="right">{formatNumber(row.lostSales)}</td>
                  <td className="right tonal-orange">{formatNumber(row.endingStock)}</td>
                  <td className="right">{formatPercent(row.fulfillmentRatePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="MRP Bahan Baku"
        subtitle="Gross requirement berasal dari MPS dikali BOM. Planned order release mengikuti lot size dan lead time bahan."
        style={{ marginTop: 16 }}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sticky-col">Bahan</th>
                <th>Supplier</th>
                <th className="right">Gross Total</th>
                <th className="right">Release Total</th>
                {algorithm.periods.map((period) => (
                  <th key={`mrp-${period.period}`} className="right">
                    Release {period.period}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {algorithm.mrp.rows.map((materialRow) => (
                <tr key={`mrp-row-${materialRow.id}`}>
                  <td className="sticky-col">
                    <strong>{materialRow.name}</strong>
                    <div className="helper-text">
                      Stok {formatNumber(materialRow.onHand, { maximumFractionDigits: 1 })} {materialRow.unit} | SS {formatNumber(materialRow.safetyStock, { maximumFractionDigits: 1 })}
                    </div>
                  </td>
                  <td>{materialRow.supplier?.name || "-"}</td>
                  <td className="right">{formatNumber(materialRow.totalGrossRequirement, { maximumFractionDigits: 1 })}</td>
                  <td className="right tonal-green">
                    <strong>{formatNumber(materialRow.totalPlannedOrderRelease, { maximumFractionDigits: 1 })}</strong>
                  </td>
                  {renderWeekColumns(materialRow, "plannedOrderReleaseValues")}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
        {renderCapacityTable(algorithm.rccp, "RCCP", "Load kasar memakai 85% dari total routing untuk validasi kapasitas awal.")}
        {renderCapacityTable(algorithm.crp, "CRP", "Load detail memakai routing penuh dan setup time per work center.")}
      </div>

      <Card
        title="Output Scheduling"
        subtitle="Jadwal harian memakai urutan produk dari CDS, order bahan baku MRP, dan status bottleneck CRP."
        style={{ marginTop: 16 }}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hari</th>
                <th>Produksi</th>
                <th>Urutan CDS</th>
                <th className="right">Makespan</th>
                <th>Order Bahan</th>
                <th>Bottleneck</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {algorithm.schedule.weeks.map((week) => (
                <tr key={`schedule-${week.period}`}>
                  <td>
                    <strong>{week.period}</strong>
                    <div className="helper-text">{formatNumber(week.total)} pcs</div>
                  </td>
                  <td>
                    <div className="pills" style={{ marginTop: 0 }}>
                      {(week.sequence?.length ? week.sequence : week.products).map((product, sequenceIndex) => (
                        <span className="mini-pill sequence-pill" key={`${week.period}-${product.id}`}>
                          <span className="sequence-index">{product.step || sequenceIndex + 1}</span>
                          <span className="product-dot" style={{ background: product.color }} />
                          {product.name}
                          <strong>{formatNumber(product.quantity)}</strong>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <strong>{week.cds?.sequence_label || "-"}</strong>
                    <div className="helper-text">
                      Iterasi {week.cds?.selected_iteration ?? "-"} dari {formatNumber(week.cds?.candidate_count || 0)} kandidat
                    </div>
                  </td>
                  <td className="right tonal-blue">
                    <strong>{formatMinutes(week.cds?.makespan_minutes || 0)}</strong>
                  </td>
                  <td>
                    <div className="pills" style={{ marginTop: 0 }}>
                      {week.materialOrders.length ? (
                        week.materialOrders.map((order) => (
                          <span className="mini-pill" key={`${week.period}-${order.id}`}>
                            {order.name}
                            <strong>{formatNumber(order.quantity, { maximumFractionDigits: 1 })} {order.unit}</strong>
                          </span>
                        ))
                      ) : (
                        <span className="helper-text">Tidak ada release</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <strong>{week.bottleneck?.id || "-"}</strong>
                    <div className="helper-text">{week.bottleneck?.name || "-"} | {formatPercent(week.bottleneck?.utilization_pct || 0)}</div>
                  </td>
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
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => loadSessionUser());
  const [tab, setTab] = useState(() => {
    const sessionUser = loadSessionUser();
    return sessionUser ? ROLE_PROFILES[sessionUser.role]?.home || "owner-dashboard" : "owner-dashboard";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const viewPeriods = FIXED_PERIOD_DAYS;
  const [selectedComponent, setSelectedComponent] = useState("");
  const [selectedMrpCategory, setSelectedMrpCategory] = useState("raw_material");
  const [selectedRoute, setSelectedRoute] = useState("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [payload, setPayload] = useState(null);
  const [databaseStatus, setDatabaseStatus] = useState(null);
  const [designContract, setDesignContract] = useState(null);
  const [forecastWorkflow, setForecastWorkflow] = useState(null);
  const [forecastPredictions, setForecastPredictions] = useState(null);
  const [forecastInput, setForecastInput] = useState(DEFAULT_FORECAST_INPUT);
  const [forecastPrepared, setForecastPrepared] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [integrationError, setIntegrationError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastSubmitting, setForecastSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [integrationReloadToken, setIntegrationReloadToken] = useState(0);
  const hasPayloadRef = useRef(false);
  const inFlightRef = useRef(false);
  const activeControllerRef = useRef(null);
  const activeRoleProfile = currentUser ? ROLE_PROFILES[currentUser.role] : null;
  const activeViewLabel = getViewLabel(activeRoleProfile, tab);

  function navigateTo(view) {
    setTab(view);
    setMenuOpen(false);
  }

  async function handleLogin(username, password) {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        const detail = Array.isArray(body.detail) ? body.detail.map((item) => item.msg).join(", ") : body.detail;
        throw new Error(detail || "Username atau password tidak sesuai dengan data login.");
      }

      const safeUser = sanitizeUser(body.user);
      setCurrentUser(safeUser);
      saveSessionUser(safeUser);
      setTab(ROLE_PROFILES[safeUser.role]?.home || "owner-dashboard");
      setPayload(null);
      setDatabaseStatus(null);
      setDesignContract(null);
      setForecastWorkflow(null);
      setForecastPredictions(null);
      setForecastPrepared(null);
      setError("");
      setIntegrationError("");
      setForecastError("");
      setLoading(true);
      setReloadToken((value) => value + 1);
      setIntegrationReloadToken((value) => value + 1);
      return { ok: true };
    } catch (caughtError) {
      return {
        ok: false,
        message: describeFetchError(caughtError, "Login belum bisa diproses."),
      };
    }
  }

  async function handlePasswordChange({ userId, username, currentPassword, newPassword }) {
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          username,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        const detail = Array.isArray(body.detail) ? body.detail.map((item) => item.msg).join(", ") : body.detail;
        throw new Error(detail || "Password belum bisa diperbarui.");
      }

      const safeUser = sanitizeUser(body.user);
      if (currentUser?.id && safeUser?.id === currentUser.id) {
        setCurrentUser(safeUser);
        saveSessionUser(safeUser);
      }
      return { ok: true, message: body.message || "Password berhasil diperbarui.", user: safeUser };
    } catch (caughtError) {
      return {
        ok: false,
        message: describeFetchError(caughtError, "Password belum bisa diperbarui."),
      };
    }
  }

  function handleLogout() {
    saveSessionUser(null);
    setCurrentUser(null);
    setPayload(null);
    setDatabaseStatus(null);
    setDesignContract(null);
    setForecastWorkflow(null);
    setForecastPredictions(null);
    setForecastPrepared(null);
    setError("");
    setIntegrationError("");
    setForecastError("");
    setLoading(true);
    setMenuOpen(false);
  }

  useEffect(() => {
    hasPayloadRef.current = payload !== null;
  }, [payload]);

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    if (activeRoleProfile && !roleHasView(activeRoleProfile, tab)) {
      setTab(activeRoleProfile.home);
    }
  }, [activeRoleProfile, currentUser, tab]);

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

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
        setError(describeFetchError(caughtError, "Terjadi kesalahan yang tidak diketahui."));
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
  }, [autoRefresh, currentUser, reloadToken, selectedComponent, viewPeriods]);

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    let isActive = true;

    async function fetchIntegrationStatus() {
      try {
        const [databaseResponse, workflowResponse, designResponse] = await Promise.all([
          fetch("/api/database/status"),
          fetch("/api/forecasting/workflow"),
          fetch("/api/design-contract"),
        ]);
        const databaseBody = await databaseResponse.json();
        const workflowBody = await workflowResponse.json();
        const designBody = await designResponse.json();

        if (!databaseResponse.ok) {
          throw new Error(databaseBody.detail || "Status database belum bisa dibaca.");
        }
        if (!workflowResponse.ok) {
          throw new Error(workflowBody.detail || "Workflow forecast belum bisa dibaca.");
        }
        if (!designResponse.ok) {
          throw new Error(designBody.detail || "Kontrak perancangan belum bisa dibaca.");
        }
        if (!isActive) {
          return;
        }

        setDatabaseStatus(databaseBody);
        setDesignContract(designBody);
        setForecastWorkflow(workflowBody);
        setIntegrationError("");
      } catch (caughtError) {
        if (!isActive) {
          return;
        }
        setIntegrationError(describeFetchError(caughtError, "Integrasi database dan forecast belum bisa dibaca."));
      }
    }

    fetchIntegrationStatus();

    return () => {
      isActive = false;
    };
  }, [currentUser, integrationReloadToken]);

  useEffect(() => {
    if (!currentUser || (tab !== "forecast-result" && tab !== 8)) {
      return undefined;
    }

    let isActive = true;

    async function fetchForecastPredictions() {
      setForecastLoading(true);
      setForecastError("");

      try {
        const response = await fetch(`/api/forecasting/predictions?horizon_days=${FIXED_PERIOD_DAYS}`);
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.detail || "Hasil forecast PostgreSQL belum bisa dibaca.");
        }
        if (!isActive) {
          return;
        }
        setForecastPredictions(body);
      } catch (caughtError) {
        if (!isActive) {
          return;
        }
        setForecastError(describeFetchError(caughtError, "Hasil forecast PostgreSQL belum bisa diproses."));
      } finally {
        if (isActive) {
          setForecastLoading(false);
        }
      }
    }

    fetchForecastPredictions();

    return () => {
      isActive = false;
    };
  }, [currentUser, integrationReloadToken, tab]);

  async function handleForecastInputSubmit(event) {
    event.preventDefault();
    setForecastSubmitting(true);
    setForecastPrepared(null);

    try {
      const response = await fetch("/api/forecasting/input", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...forecastInput,
          horizon_days: Number(forecastInput.horizon_days),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.detail || "Input forecast belum valid.");
      }
      setForecastPrepared(body);
      setIntegrationError("");
    } catch (caughtError) {
      setIntegrationError(describeFetchError(caughtError, "Input forecast belum bisa diproses."));
    } finally {
      setForecastSubmitting(false);
    }
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} onChangePassword={handlePasswordChange} />;
  }

  if (loading && !payload) {
    return <LoadingState />;
  }

  const dashboard = payload?.dashboard ?? {};
  const forecast = payload?.forecast ?? { periods: [], rows: [] };
  const mps = payload?.mps ?? { periods: [], rows: [] };
  const mrp = payload?.mrp ?? { categories: [], items: [], items_by_category: {}, periods: [] };
  const rccp = payload?.rccp ?? { periods: [], work_centers: [] };
  const crp = payload?.crp ?? payload?.capacity ?? { periods: [], work_centers: [] };
  const capacity = crp;
  const schedule = payload?.schedule ?? { weeks: [] };
  const routes = payload?.routes ?? { routes: [], stores: [] };
  const billOfMaterial = buildCoret2BillOfMaterialPayload();

  const displayMrpItemsByCategory = Object.fromEntries(
    (mrp.categories || []).map((category) => [
      category.key,
      (mrp.items_by_category?.[category.key] || []).filter(shouldDisplayMrpItem),
    ]),
  );
  const displayMrpItems = Object.values(displayMrpItemsByCategory).flat();
  const activeMrpItems = displayMrpItemsByCategory[selectedMrpCategory] ?? [];
  const selectedMrpItem =
    displayMrpItems.find((item) => item.id === (mrp.selected_item?.id || selectedComponent)) ||
    activeMrpItems[0] ||
    null;
  const filteredRoutes =
    selectedRoute === "ALL"
      ? routes.routes
      : routes.routes.filter((route) => route.id === selectedRoute);
  const peakLoad = dashboard.peak_load?.bottleneck || null;
  const databaseTables = databaseStatus?.tables ?? [];
  const designEntities = designContract?.data_dictionary ?? [];
  const functionalRequirements = designContract?.functional_requirements ?? {};
  const nonFunctionalRequirements = designContract?.non_functional_requirements ?? [];
  const displayMpsPeriods = withDayPeriodLabels(mps.periods || []);
  const displayMpsRows = (mps.rows || []).map((row) => ({
    ...row,
    values: slicePeriodValues(row.values || []),
    total: sumPeriodValues(row.values || []),
  }));
  const displayMpsTotalProduction = displayMpsRows.reduce((sum, row) => sum + (row.total || 0), 0);
  const displayMrpPeriods = withDayPeriodLabels(mrp.periods || []);
  const displayCapacityPeriods = withDayPeriodLabels(capacity.periods || []);
  const displayScheduleWeeks = (schedule.weeks || []).slice(0, FIXED_PERIOD_DAYS).map((week, index) => ({
    ...week,
    period: getDayPeriodLabel(index),
  }));
  const outputScheduleRows = displayScheduleWeeks.map((week) => ({
    period: week.period,
    total: week.total,
    bottleneck_utilization: week.bottleneck?.utilization_pct || 0,
    status_label: week.status?.label || "Normal",
    status_color: week.status?.color || "#34d399",
    products: week.products || [],
    sequence: week.sequence?.length ? week.sequence : (week.products || []).map((product, index) => ({
      ...product,
      step: index + 1,
      completion_time_minutes: 0,
    })),
    sequence_label: week.cds?.sequence_label || (week.products || []).map((product) => product.id).join(" -> "),
    makespan_minutes: week.cds?.makespan_minutes || 0,
    selected_iteration: week.cds?.selected_iteration,
    candidate_count: week.cds?.candidate_count || 0,
  }));
  const maxOutputScheduleTotal = Math.max(...outputScheduleRows.map((week) => week.total), 1);
  const scheduleAlgorithm = schedule.algorithm || {
    key: "cds",
    name: "Campbell-Dudek-Smith (CDS)",
    description: "CDS membentuk kandidat Johnson untuk beberapa split work center, lalu memilih urutan dengan makespan terendah.",
  };
  const peakOutputMakespan = outputScheduleRows.reduce(
    (peak, week) => (week.makespan_minutes > (peak?.makespan_minutes || 0) ? week : peak),
    outputScheduleRows[0] || null,
  );
  const totalCdsCandidates = outputScheduleRows.reduce((sum, week) => sum + week.candidate_count, 0);

  return (
    <div className="app-shell">
      <div
        className={`side-nav-backdrop ${menuOpen ? "is-open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />
      <aside className={`side-toolbar ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
        <div className="side-toolbar-head">
          <div>
            <span>{activeRoleProfile.label}</span>
            <strong>{activeRoleProfile.title}</strong>
          </div>
          <button className="toolbar-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Tutup menu">
            X
          </button>
        </div>
        <nav className="side-menu-list" aria-label="Menu utama DSS">
          <button
            type="button"
            className={`side-menu-button ${tab === activeRoleProfile.home ? "is-active" : ""}`}
            onClick={() => navigateTo(activeRoleProfile.home)}
          >
            <span className="side-menu-index">00</span>
            <span>{activeRoleProfile.title}</span>
          </button>
          {activeRoleProfile.menu.map((section) => (
            <div className="side-menu-section" key={section.title}>
              <div className="side-menu-section-title">{section.title}</div>
              {section.items.map((item) => (
                <button
                  key={`${section.title}-${item.label}`}
                  type="button"
                  className={`side-menu-button ${item.level ? "is-child" : ""} ${tab === item.view ? "is-active" : ""}`}
                  onClick={() => navigateTo(item.view)}
                >
                  <span className="side-menu-index">{typeof item.view === "number" ? String(item.view + 1).padStart(2, "0") : ""}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-toolbar-footer">
          <span>Menu aktif</span>
          <strong>{activeViewLabel}</strong>
        </div>
      </aside>

      <header className="hero">
        <div className="hero-inner">
          <div className="hero-top">
            <div className="brand">
              <button
                className="toolbar-toggle"
                type="button"
                aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
              >
                <span />
                <span />
                <span />
              </button>
              <div className="brand-mark">B</div>
              <div className="brand-copy">
                <h1>BAKERY DSS SCHEDULING SYSTEM</h1>
                <p>Login sebagai {currentUser.department}; menu aktif mengikuti kategori user pada diagram alur.</p>
              </div>
            </div>

            <div className="source-stack">
              <div className="source-pill">
                <span>User</span>
                <code>{currentUser.name}</code>
              </div>
              <div className="source-pill">
                <span>Sumber data</span>
                <code>{payload?.meta?.source_name || "-"}</code>
              </div>
              <div className="metric-pill">
                Periode algoritma: <strong>{viewPeriods} hari</strong>
              </div>
              <div className="metric-pill">
                Sinkron terakhir: <strong>{formatClock(lastSyncedAt)}</strong>
              </div>
              <button type="button" className="chip-button" onClick={() => navigateTo("change-password")}>
                Ganti Password
              </button>
              <button type="button" className="chip-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>

          <nav className="desktop-navbar" aria-label="Navigasi utama desktop">
            <button
              type="button"
              className={`desktop-nav-home ${tab === activeRoleProfile.home ? "is-active" : ""}`}
              onClick={() => navigateTo(activeRoleProfile.home)}
            >
              <span>Overview</span>
              <strong>{activeRoleProfile.label}</strong>
            </button>
            {activeRoleProfile.menu.map((section) => {
              const sectionIsActive = section.items.some((item) => item.view === tab);
              const firstView = section.items[0]?.view ?? activeRoleProfile.home;
              return (
                <div className={`desktop-nav-group ${sectionIsActive ? "is-active" : ""}`} key={section.title}>
                  <button
                    type="button"
                    className="desktop-nav-trigger"
                    onClick={() => navigateTo(firstView)}
                  >
                    <span>{section.title}</span>
                    <strong>{formatNumber(section.items.length)}</strong>
                  </button>
                  <div className="desktop-submenu">
                    {section.items.map((item) => (
                      <button
                        key={`${section.title}-desktop-${item.label}`}
                        type="button"
                        className={`desktop-submenu-item ${item.level ? "is-child" : ""} ${tab === item.view ? "is-active" : ""}`}
                        onClick={() => navigateTo(item.view)}
                      >
                        <span>{item.label}</span>
                        {typeof item.view === "number" ? <strong>{TABS[item.view] || "DSS"}</strong> : null}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          <section className="hero-showcase" aria-label="Ringkasan sistem">
            <div className="hero-copy-block">
              <span className="hero-kicker">Modern decision dashboard</span>
              <h2>Balimo Bakery Planning Suite</h2>
              <p>
                Dashboard produksi, ramalan permintaan, persediaan bahan baku, dan penjadwalan dibuat dalam satu ruang kerja yang bersih untuk pengambilan keputusan harian.
              </p>
            </div>
            <div className="hero-visual-stage">
              <div className="product-device" aria-hidden="true">
                <div className="device-toolbar">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="device-chart">
                  <i style={{ height: "48%" }} />
                  <i style={{ height: "68%" }} />
                  <i style={{ height: "38%" }} />
                  <i style={{ height: "82%" }} />
                  <i style={{ height: "56%" }} />
                </div>
                <div className="device-row">
                  <span>Forecast</span>
                  <strong>{formatNumber(dashboard.total_production)}</strong>
                </div>
              </div>
              <div className="hero-metric-grid">
                <div className="hero-metric">
                  <span>Total Produksi</span>
                  <strong>{formatNumber(dashboard.total_production)}</strong>
                  <small>{viewPeriods} hari</small>
                </div>
                <div className="hero-metric">
                  <span>Kapasitas</span>
                  <strong>{formatPercent(dashboard.average_capacity_utilization)}</strong>
                  <small>utilisasi rata-rata</small>
                </div>
                <div className="hero-metric">
                  <span>Sumber</span>
                  <strong>PostgreSQL</strong>
                  <small>{formatClock(lastSyncedAt)}</small>
                </div>
              </div>
            </div>
          </section>

          <div className="hero-actions">
            <div className="active-module-strip">
              <span>Menu aktif</span>
              <strong>{activeViewLabel}</strong>
            </div>

            <div className="period-row">
              <span className="metric-pill fixed-period-pill">
                MPS, RCCP, CRP, MRP: <strong>{viewPeriods} hari</strong>
              </span>
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

        {tab === activeRoleProfile.home && (
          <RoleHomePage
            currentUser={currentUser}
            profile={activeRoleProfile}
            dashboard={dashboard}
            mps={mps}
            mrp={mrp}
            rccp={rccp}
            capacity={capacity}
            schedule={schedule}
            routes={routes}
            viewPeriods={viewPeriods}
            onNavigate={navigateTo}
          />
        )}

        {tab === "forecast-result" && (
          <ForecastResultPage
            forecast={forecast}
            mps={mps}
            dashboard={dashboard}
            viewPeriods={viewPeriods}
            forecastPredictions={forecastPredictions}
            designContract={designContract}
            forecastLoading={forecastLoading}
            forecastError={forecastError}
            onRefreshForecast={() => setIntegrationReloadToken((value) => value + 1)}
          />
        )}

        {tab === "change-password" && (
          <PasswordChangePage
            currentUser={currentUser}
            onChangePassword={handlePasswordChange}
            onNavigate={navigateTo}
          />
        )}

        {tab === "report-material-orders" && (
          <MaterialOrderReportPage mrp={mrp} />
        )}

        {tab === "bill-of-material" && (
          <BillOfMaterialPage billOfMaterial={billOfMaterial} />
        )}

        {tab === "segmentation" && (
          <StoreSegmentationPage routes={routes} onNavigate={navigateTo} />
        )}

        {tab === "data-products" && (
          <DataHubPage
            title="Halaman Data Produk"
            subtitle="Cabang input master produk roti, bahan baku, dan supplier."
            onNavigate={navigateTo}
            items={[
              { view: "input-product", label: "Input Data Produk Roti", meta: "Produk_Roti" },
              { view: "input-material", label: "Input Data Bahan Baku", meta: "Bahan_Baku" },
              { view: "input-supplier", label: "Input Data Supplier", meta: "Supplier" },
            ]}
          />
        )}

        {tab === "data-materials" && (
          <DataHubPage
            title="Halaman Data Bahan Baku"
            subtitle="Cabang input stok bahan baku aktual untuk MRP dan pemesanan bahan baku."
            onNavigate={navigateTo}
            items={[
              { view: "input-material-stock", label: "Input Data Stok Bahan Baku", meta: "Stok_Bahan_Baku" },
            ]}
          />
        )}

        {tab === "data-sales" && (
          <DataHubPage
            title="Halaman Data Penjualan"
            subtitle="Cabang input stok roti dan kuantitas produk laku sebagai data aktual peramalan."
            onNavigate={navigateTo}
            items={[
              { view: "input-product-stock", label: "Input Data Stok Roti", meta: "Input_Penjualan_Produksi" },
              { view: "input-sales-qty", label: "Input Data Kuantitas Produk Laku", meta: "Input_Penjualan_Produksi" },
            ]}
          />
        )}

        {tab === "data-supplier-store" && (
          <SupplierStoreDataPage routes={routes} onNavigate={navigateTo} />
        )}

        {FORM_DEFINITIONS[tab] && (
          <InputDataPage view={tab} currentUser={currentUser} onNavigate={navigateTo} />
        )}

        {tab === 0 && (
          <>
            <div className="panel-grid cols-4">
              <StatCard
                icon="PP"
                label="Total Produksi"
                value={formatNumber(dashboard.total_production)}
                meta={`${viewPeriods} hari terpilih`}
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
                title="Total Produksi per Hari"
                subtitle="Data diambil langsung dari tabel MPS PostgreSQL."
                extra={<span className="badge">{viewPeriods} hari</span>}
              >
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={displayMpsPeriods}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                      <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                      <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Bar dataKey="total" fill="#0891b2" radius={[8, 8, 0, 0]} />
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
                    <LineChart data={displayCapacityPeriods}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                      <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                      <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} unit="%" />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Legend />
                      <Line type="monotone" dataKey="total_utilization_pct" name="Total Utilisasi" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="bottleneck_utilization_pct" name="Bottleneck" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card
                title="Ringkasan Data Aktif"
                subtitle="Scenario PostgreSQL yang sedang dipakai backend."
              >
                <div className="stack-list">
                  <div className="metric-pill">
                    Sumber aktif: <strong>{payload?.meta?.source_path || "-"}</strong>
                  </div>
                  <div className="metric-pill">
                    Scenario tersedia: <strong>{formatNumber(payload?.files?.length || 0)}</strong>
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
                    Scenario database: <strong>{formatNumber(payload?.files?.length || 0)}</strong>
                  </div>
                </div>
                <div className="inline-note">
                  Backend membaca schema PostgreSQL `dss` sebagai sumber data API.
                </div>
                <div className="inline-note">
                  Saat auto-sync aktif, perubahan data PostgreSQL akan muncul setelah refresh berkala sekitar {AUTO_REFRESH_MS / 1000} detik.
                </div>
              </Card>
            </div>
          </>
        )}

        {tab === 1 && (
          <Card
            title="Jadwal Induk Produksi"
            subtitle="Semua nilai di tabel berasal dari tabel MPS PostgreSQL."
            extra={<span className="badge">{viewPeriods} hari</span>}
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="sticky-col">Produk</th>
                    {displayMpsPeriods.map((period) => (
                      <th key={period.period} className="center">
                        {period.period}
                      </th>
                    ))}
                    <th className="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {displayMpsRows.map((row) => (
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
                    {displayMpsPeriods.map((period) => (
                      <td key={`total-${period.period}`} className="center tonal-orange">
                        <strong>{formatNumber(period.total)}</strong>
                      </td>
                    ))}
                    <td className="right tonal-orange">
                      <strong>{formatNumber(displayMpsTotalProduction)}</strong>
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
              subtitle="Semua nilai MRP mengikuti tabel PostgreSQL untuk periode tetap 20 hari. Pilih kategori lalu klik item untuk melihat detail periodenya."
            >
              <div className="chip-row">
                {mrp.categories?.map((category) => {
                  const firstItem = displayMrpItemsByCategory[category.key]?.[0];
                  const itemCount = displayMrpItemsByCategory[category.key]?.length || 0;
                  return (
                    <button
                      key={category.key}
                      className={`chip-button ${selectedMrpCategory === category.key ? "is-active" : ""}`}
                      onClick={() => {
                        setSelectedMrpCategory(category.key);
                        if (firstItem) {
                          setSelectedComponent(firstItem.id);
                        }
                      }}
                    >
                      {category.label} ({formatNumber(itemCount)})
                    </button>
                  );
                })}
              </div>

              <div className="footer-strip">
                <span className="metric-pill">
                  Item aktif: <strong>{selectedMrpItem?.label || "-"}</strong>
                </span>
                <span className="metric-pill">
                  Sumber MRP: <strong>Sheet MRP / data perencanaan aktif</strong>
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
                      {displayMrpPeriods.map((row) => (
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
                    <LineChart data={displayMrpPeriods}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                      <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                      <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Legend />
                      <Line type="monotone" dataKey="gross_requirement" name="Gross Requirement" stroke="#f59e0b" strokeWidth={2.25} dot={false} />
                      <Line type="monotone" dataKey="planned_order_receipt" name="Planned Order Receipt" stroke="#22d3ee" strokeWidth={2.25} dot={false} />
                      <Line type="monotone" dataKey="planned_order_release" name="Planned Order Release" stroke="#34d399" strokeWidth={2.25} dot={false} />
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
            subtitle="RCCP mengikuti parameter load dan available time dari sheet BOL + RCCP."
            plan={rccp}
            viewPeriods={viewPeriods}
            loadChartTitle="Load vs Available Time RCCP"
            loadChartSubtitle="Perbandingan load rough-cut terhadap available time dari sheet BOL + RCCP."
            utilizationTitle="Utilisasi RCCP per Work Center"
            utilizationSubtitle="Garis utilisasi rough-cut untuk semua work center yang tercantum pada sheet BOL + RCCP."
            tableTitle="Tabel Utilisasi RCCP"
            tableSubtitle='Nilai tabel ditulis sebagai "load / available time" dalam menit/hari berdasarkan sheet BOL + RCCP.'
          />
        )}

        {tab === 4 && (
          <CapacitySection
            title="Capacity Requirements Planning"
            subtitle="CRP memakai run time, setup time, total kebutuhan, dan available time dari sheet CRP."
            plan={crp}
            viewPeriods={viewPeriods}
            loadChartTitle="Load vs Available Time CRP"
            loadChartSubtitle="Perbandingan total kebutuhan kapasitas detail terhadap available time dari sheet CRP."
            utilizationTitle="Utilisasi CRP per Work Center"
            utilizationSubtitle="Garis utilisasi seluruh WC berdasarkan total kebutuhan kapasitas pada sheet CRP."
            tableTitle="Tabel Utilisasi CRP"
            tableSubtitle='Nilai tabel ditulis sebagai "load / available time" dalam menit/hari berdasarkan sheet CRP.'
          />
        )}

        {tab === 5 && (
          <>
            <Card
              title="Algoritma Scheduling CDS"
              subtitle={scheduleAlgorithm.description}
              extra={<span className="badge">{scheduleAlgorithm.name}</span>}
            >
              <div className="footer-strip" style={{ marginTop: 0 }}>
                <span className="metric-pill">
                  Kandidat dievaluasi: <strong>{formatNumber(totalCdsCandidates)}</strong>
                </span>
                <span className="metric-pill">
                  Makespan puncak: <strong>{formatMinutes(peakOutputMakespan?.makespan_minutes || 0)}</strong>
                </span>
                <span className="metric-pill">
                  Periode puncak: <strong>{peakOutputMakespan?.period || "-"}</strong>
                </span>
              </div>
              <div className="inline-note">
                Urutan produksi di bawah mengikuti kandidat CDS terbaik per hari; status kapasitas tetap memakai bottleneck CRP.
              </div>
            </Card>

            <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
              <Card
                title="Visual Total Produksi Jadwal"
                subtitle="Grafik ini menampilkan total planned production order per hari."
              >
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={outputScheduleRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                      <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                      <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Bar dataKey="total" name="Total Produksi" fill="#0891b2" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card
                title="Visual Status Bottleneck"
                subtitle="Garis menunjukkan utilisasi bottleneck CRP yang menentukan status jadwal."
              >
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <LineChart data={outputScheduleRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                      <XAxis dataKey="period" tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} />
                      <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }} unit="%" />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="bottleneck_utilization" name="Bottleneck Utilization" stroke="#34d399" strokeWidth={2.5} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card
              title="Timeline Visual Jadwal"
              subtitle="Bar produksi memperlihatkan besar kecilnya beban hari tersebut dan status kapasitasnya."
              style={{ marginTop: 16 }}
            >
              <div className="schedule-visual-list">
                {outputScheduleRows.map((week) => (
                  <div className="schedule-visual-row" key={`output-visual-${week.period}`}>
                    <div className="schedule-visual-label">
                      <strong>{week.period}</strong>
                      <span>{formatNumber(week.total)} pcs</span>
                    </div>
                    <div className="schedule-visual-track">
                      <div
                        className="schedule-visual-bar"
                        style={{
                          width: `${Math.max(6, (week.total / maxOutputScheduleTotal) * 100)}%`,
                          background: `linear-gradient(90deg, ${week.status_color}, rgba(249,115,22,0.78))`,
                        }}
                      >
                        {week.sequence_label || week.products.map((product) => product.name).slice(0, 3).join(", ") || "-"}
                      </div>
                    </div>
                    <div className="schedule-visual-status">
                      <span className="status-label" style={{ color: week.status_color }}>
                        {week.status_label}
                      </span>
                      <span>{formatPercent(week.bottleneck_utilization)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
              <Card
                title="Urutan Produksi CDS"
                subtitle="Rekap produk per hari dalam urutan hasil algoritma CDS."
              >
                <div className="stack-list">
                  {displayScheduleWeeks.map((week) => (
                    <div className="schedule-card" key={week.period}>
                      <div className="schedule-head">
                        <div>
                          <div className="schedule-period">{week.period}</div>
                          <div className="schedule-total">{formatNumber(week.total)} pcs</div>
                        </div>
                        <StatusLabel status={week.status} />
                      </div>
                      <div className="footer-strip">
                        <span className="metric-pill">
                          Iterasi CDS: <strong>{week.cds?.selected_iteration ?? "-"}</strong>
                        </span>
                        <span className="metric-pill">
                          Makespan: <strong>{formatMinutes(week.cds?.makespan_minutes || 0)}</strong>
                        </span>
                      </div>
                      <div className="pills">
                        {(week.sequence?.length ? week.sequence : week.products).map((product, index) => (
                          <div className="mini-pill sequence-pill" key={`${week.period}-${product.id}`}>
                            <span className="sequence-index">{product.step || index + 1}</span>
                            <span className="product-dot" style={{ background: product.color }} />
                            <span>{product.name}</span>
                            <strong>{formatNumber(product.quantity)}</strong>
                            {product.completion_time_minutes ? (
                              <span className="sequence-meta">{formatMinutes(product.completion_time_minutes)}</span>
                            ) : null}
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
              subtitle="Ringkasan produksi, rute aktif, dan status kapasitas per hari."
              extra={<span className="badge">{viewPeriods} hari</span>}
            >
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Hari</th>
                      <th>Produk Diproduksi</th>
                      <th>Urutan CDS</th>
                      <th className="center">Makespan</th>
                      <th className="center">Total Qty</th>
                      <th>Rute Aktif</th>
                      <th>Status Kapasitas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayScheduleWeeks.map((week) => (
                      <tr key={`summary-${week.period}`}>
                        <td>
                          <strong>{week.period}</strong>
                        </td>
                        <td>{week.products.map((product) => product.name).join(", ")}</td>
                        <td>
                          <strong>{week.cds?.sequence_label || week.products.map((product) => product.id).join(" -> ")}</strong>
                          <div className="helper-text">
                            Iterasi {week.cds?.selected_iteration ?? "-"} dari {formatNumber(week.cds?.candidate_count || 0)} kandidat
                          </div>
                        </td>
                        <td className="center tonal-blue">
                          <strong>{formatMinutes(week.cds?.makespan_minutes || 0)}</strong>
                        </td>
                        <td className="center">{formatNumber(week.total)}</td>
                        <td>{(week.routes || []).map((route) => route.id).join(", ")}</td>
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
                          <span>{store.name} | {store.location}</span>
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

        {tab === 7 && <PlannerWorkbench />}

        {tab === 8 && (
          <>
            <div className="panel-grid cols-3">
              <StatCard
                icon="DB"
                label="PostgreSQL"
                value={databaseStatus?.connected ? "Connected" : "Waiting"}
                meta={databaseStatus?.message || integrationError || "Mengecek schema DSS"}
                toneClass={databaseStatus?.connected ? "tonal-green" : "tonal-orange"}
              />
              <StatCard
                icon="SQL"
                label="Tabel Dictionary"
                value={formatNumber((databaseStatus?.dictionary_table_count || 0) - (databaseStatus?.dictionary_missing_count || 0))}
                meta={`${formatNumber(databaseStatus?.dictionary_missing_count || 0)} belum dibuat | ${formatNumber(databaseStatus?.foreign_key_count || 0)} foreign key`}
                toneClass="tonal-blue"
              />
              <StatCard
                icon="FC"
                label="Forecast Bridge"
                value={forecastWorkflow?.bridge_ready ? "Ready" : "Draft"}
                meta={forecastWorkflow?.forecast_project_found ? "Modul forecast ditemukan" : "Modul forecast belum ditemukan"}
                toneClass={forecastWorkflow?.integrated ? "tonal-green" : "tonal-purple"}
              />
            </div>

            {integrationError ? (
              <div className="inline-note" style={{ marginTop: 16 }}>
                Integrasi mengembalikan pesan: <strong>{integrationError}</strong>
              </div>
            ) : null}

            <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
              <Card
                title="Status Database PostgreSQL"
                subtitle="Frontend dan backend membaca schema PostgreSQL sebagai sumber utama untuk dashboard DSS."
                extra={
                  <button className="chip-button is-active" onClick={() => setIntegrationReloadToken((value) => value + 1)}>
                    Refresh
                  </button>
                }
              >
                <div className="footer-strip" style={{ marginTop: 0 }}>
                  <span className="metric-pill">
                    Database: <strong>{databaseStatus?.database || "balimo_bakery_dss"}</strong>
                  </span>
                  <span className="metric-pill">
                    Schema: <strong>{databaseStatus?.schema || "dss"}</strong>
                  </span>
                  <span className="metric-pill">
                    Status: <strong>{databaseStatus?.connected ? "Terhubung" : "Belum terhubung"}</strong>
                  </span>
                  <span className="metric-pill">
                    Tabel sumber: <strong>{formatNumber((databaseStatus?.dictionary_table_count || 0) - (databaseStatus?.dictionary_missing_count || 0))}/{formatNumber(databaseStatus?.dictionary_table_count || 0)}</strong>
                  </span>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tabel</th>
                        <th className="right">Rows</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {databaseTables.length ? (
                        databaseTables.map((table) => (
                          <tr key={table.name}>
                            <td>{table.name}</td>
                            <td className="right tonal-blue">
                              <strong>{formatNumber(table.rows)}</strong>
                            </td>
                            <td>
                              <StatusLabel
                                status={{
                                  label: table.exists === false ? "Belum dibuat" : "Ready",
                                  color: table.exists === false ? "#f59e0b" : "#34d399",
                                }}
                              />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td>Belum ada status tabel</td>
                          <td className="right">-</td>
                          <td>-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card
                title="Workflow Forecast ke Scheduling"
                subtitle="Alur ini menyiapkan Ramalan_Permintaan sebelum hasil forecast dipakai oleh MPS, RCCP, MRP, dan CRP."
              >
                <div className="stack-list">
                  {(forecastWorkflow?.next_steps || []).map((step, index) => (
                    <div className="workflow-step" key={step}>
                      <span>{index + 1}</span>
                      <p>{step}</p>
                    </div>
                  ))}
                </div>
                <div className="inline-note">
                  Endpoint forecast sudah aktif memakai data PostgreSQL. Outputnya diarahkan ke Ramalan_Permintaan sesuai data dictionary sebelum menjadi dasar MPS.
                </div>
              </Card>
            </div>

            <div className="panel-grid cols-2" style={{ marginTop: 16 }}>
              <Card
                title="Functional Requirement Coret2"
                subtitle="Hak akses dan proses utama yang dipenuhi menu Owner, Produksi, dan Pemasaran."
              >
                <div className="footer-strip" style={{ marginTop: 0, marginBottom: 14 }}>
                  <span className="metric-pill">
                    Owner output: <strong>{formatNumber(functionalRequirements.owner?.output?.length || 0)}</strong>
                  </span>
                  <span className="metric-pill">
                    Produksi input: <strong>{formatNumber(functionalRequirements.production?.input?.length || 0)}</strong>
                  </span>
                  <span className="metric-pill">
                    Pemasaran output: <strong>{formatNumber(functionalRequirements.marketing?.output?.length || 0)}</strong>
                  </span>
                </div>
                <div className="stack-list">
                  {(functionalRequirements.processing || []).slice(0, 5).map((item, index) => (
                    <div className="workflow-step" key={item}>
                      <span>{index + 1}</span>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card
                title="Non-Functional Requirement"
                subtitle="Kebutuhan kualitas sistem dari Coret2."
              >
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Area</th>
                        <th>Kebutuhan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nonFunctionalRequirements.map((item) => (
                        <tr key={item.area}>
                          <td><strong>{item.area}</strong></td>
                          <td>{item.requirement}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <Card
              title="Data Dictionary Coret2"
              subtitle="Entitas perancangan yang menjadi acuan DFD, ERD, dan form input."
              style={{ marginTop: 16 }}
            >
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Entitas</th>
                      <th>Primary Key</th>
                      <th>Atribut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {designEntities.map((entity) => (
                      <tr key={entity.entity}>
                        <td><strong>{entity.entity}</strong></td>
                        <td className="tonal-blue">{entity.primary_key}</td>
                        <td>{(entity.fields || []).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card
              title="Input Sebelum Algoritma Forecast"
              subtitle="Form ini menyimpan konfigurasi awal dari Input_Penjualan_Produksi menuju Ramalan_Permintaan."
              style={{ marginTop: 16 }}
            >
              <form className="forecast-form" onSubmit={handleForecastInputSubmit}>
                <label className="form-field">
                  <span>Sumber Data</span>
                  <select
                    value={forecastInput.source}
                    onChange={(event) => setForecastInput((previous) => ({ ...previous, source: event.target.value }))}
                  >
                    <option value="upload">Histori PostgreSQL</option>
                    <option value="database">Database PostgreSQL</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>Horizon Forecast (hari)</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={forecastInput.horizon_days}
                    onChange={(event) => setForecastInput((previous) => ({ ...previous, horizon_days: event.target.value }))}
                  />
                </label>

                <label className="form-field">
                  <span>Agregasi</span>
                  <select
                    value={forecastInput.aggregation}
                    onChange={(event) => setForecastInput((previous) => ({ ...previous, aggregation: event.target.value }))}
                  >
                    <option value="daily">Harian</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>Kolom Tanggal Input</span>
                  <input
                    value={forecastInput.date_column}
                    onChange={(event) => setForecastInput((previous) => ({ ...previous, date_column: event.target.value }))}
                  />
                </label>

                <label className="form-field">
                  <span>Kolom Jumlah Laku</span>
                  <input
                    value={forecastInput.quantity_column}
                    onChange={(event) => setForecastInput((previous) => ({ ...previous, quantity_column: event.target.value }))}
                  />
                </label>

                <label className="form-field">
                  <span>Kolom Id Produk</span>
                  <input
                    value={forecastInput.product_column}
                    onChange={(event) => setForecastInput((previous) => ({ ...previous, product_column: event.target.value }))}
                  />
                </label>

                <label className="form-field">
                  <span>Kolom Id Toko</span>
                  <input
                    value={forecastInput.store_column}
                    onChange={(event) => setForecastInput((previous) => ({ ...previous, store_column: event.target.value }))}
                  />
                </label>

                <div className="toggle-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={forecastInput.write_to_database}
                      onChange={(event) => setForecastInput((previous) => ({ ...previous, write_to_database: event.target.checked }))}
                    />
                    Simpan hasil forecast ke Ramalan_Permintaan
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={forecastInput.feed_to_planning}
                      onChange={(event) => setForecastInput((previous) => ({ ...previous, feed_to_planning: event.target.checked }))}
                    />
                    Pakai forecast sebagai dasar MPS
                  </label>
                </div>

                <div className="footer-strip">
                  <button className="chip-button is-active" type="submit" disabled={forecastSubmitting}>
                    {forecastSubmitting ? "Memproses..." : "Validasi Input Forecast"}
                  </button>
                  {forecastPrepared?.ready ? (
                    <span className="metric-pill">
                      Status input: <strong>Siap</strong>
                    </span>
                  ) : null}
                </div>
              </form>

              {forecastPrepared ? (
                <div className="inline-note">
                  Input valid. Output forecast nantinya diarahkan ke <strong>{forecastPrepared.database_flow?.forecast_output_table}</strong>, lalu dipakai untuk MPS/RCCP/MRP/CRP.
                </div>
              ) : null}
            </Card>
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
            Sumber data: <strong>{payload?.meta?.source_name || "-"}</strong>
          </span>
        </div>
      </main>
    </div>
  );
}

export default App;
