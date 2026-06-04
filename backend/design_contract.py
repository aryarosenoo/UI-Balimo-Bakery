from __future__ import annotations

from typing import Any


DFD_DATA_STORES = [
    {"code": "D1", "name": "Data Produk Roti", "entities": ["Produk_Roti"]},
    {"code": "D2", "name": "Data Toko", "entities": ["Toko", "Rute", "Cluster", "Lokasi"]},
    {"code": "D3", "name": "Data Bahan Baku dan Stok", "entities": ["Bahan_Baku"]},
    {"code": "D4", "name": "Data Bill of Material / BOM", "entities": ["BOM_Produk"]},
    {"code": "D5", "name": "Data Master Production Schedule / MPS", "entities": ["MPS"]},
    {"code": "D6", "name": "Data Material Requirement Planning / MRP", "entities": ["MRP"]},
    {"code": "D7", "name": "Data Supplier", "entities": ["Supplier"]},
    {"code": "D8", "name": "Data Pemesanan Bahan Baku", "entities": ["Pemesanan_Bahan_Baku", "Detail_Pemesanan_Bahan_Baku"]},
    {"code": "D9", "name": "Data Penjadwalan", "entities": ["Jadwal_Produksi"]},
    {"code": "D10", "name": "Data Ramalan Permintaan", "entities": ["Ramalan_Permintaan", "Input_Penjualan_Produksi"]},
    {"code": "D11", "name": "Data Pengguna", "entities": ["Owner", "Karyawan Produksi"]},
]


DATA_DICTIONARY = [
    {
        "entity": "Bahan_Baku",
        "primary_key": "Id_bahan_baku",
        "fields": [
            "Id_bahan_baku",
            "Id_supplier",
            "Nama_bahan_baku",
            "Jenis_bahan_baku",
            "Satuan",
            "Stok",
            "Lead_time",
            "Harga_satuan",
        ],
    },
    {
        "entity": "MRP",
        "primary_key": "Id_mrp",
        "fields": [
            "Id_mrp",
            "Id_mps",
            "Id_bahan_baku",
            "Periode",
            "Gross_requirement",
            "Scheduled_receipt",
            "Projected_on_hand",
            "Net_requirement",
            "Planned_order_receipt",
            "Planned_order_release",
            "Lead_time",
            "Status_mrp",
        ],
    },
    {
        "entity": "MPS",
        "primary_key": "Id_mps",
        "fields": [
            "Id_mps",
            "Id_produk",
            "Id_kebutuhan_distribusi",
            "Id_pengguna_pembuat",
            "Id_pengguna_penyetuju",
            "Periode",
            "Jumlah_produksi",
            "Status_mps",
            "Tanggal_dibuat",
            "Tanggal_disetujui",
        ],
    },
    {
        "entity": "Supplier",
        "primary_key": "Id_supplier",
        "fields": ["Id_supplier", "Nama_supplier", "Alamat", "No_telepon"],
    },
    {
        "entity": "Toko",
        "primary_key": "Id_toko",
        "fields": ["Id_toko", "Nama_toko", "Alamat", "No_telepon"],
    },
    {
        "entity": "BOM_Produk",
        "primary_key": "Id_bom",
        "fields": ["Id_bom", "Id_produk", "Id_bahan_baku", "Jumlah_kebutuhan", "Satuan"],
    },
    {
        "entity": "Kebutuhan_distribusi",
        "primary_key": "Id_kebutuhan_distribusi",
        "fields": ["Id_kebutuhan_distribusi", "Id_pengguna", "Tanggal_perencanaan", "Periode", "Status_kebutuhan", "Keterangan"],
    },
    {
        "entity": "Detail_Kebutuhan_Distribusi",
        "primary_key": "Id_detail_kebutuhan_distribusi",
        "fields": ["Id_detail_kebutuhan_distribusi", "Id_kebutuhan_distribusi", "Id_toko", "Id_produk", "Jumlah_kebutuhan"],
    },
    {
        "entity": "Pemesanan_Bahan_Baku",
        "primary_key": "Id_pemesanan",
        "fields": [
            "Id_pemesanan",
            "Id_supplier",
            "Id_pengguna_pembuat",
            "Id_pengguna_penyetuju",
            "Tanggal_pemesanan",
            "Status_pemesanan",
            "Status_persetujuan",
            "Keterangan",
        ],
    },
    {
        "entity": "Detail_Pemesanan_Bahan_Baku",
        "primary_key": "Id_detail_pemesanan",
        "fields": [
            "Id_detail_pemesanan",
            "Id_pemesanan",
            "Id_bahan_baku",
            "Id_mrp",
            "Jumlah_pesan",
            "Jumlah_terkonfirmasi",
            "Tanggal_kebutuhan",
            "Tanggal_pengiriman_rencana",
            "Harga_satuan",
            "Subtotal",
            "Status_detail",
        ],
    },
    {
        "entity": "Produk_Roti",
        "primary_key": "Id_produk",
        "fields": ["Id_produk", "Id_kategori", "Nama_produk", "Varian_rasa", "Harga_jual", "Satuan"],
    },
    {
        "entity": "Karyawan Produksi",
        "primary_key": "Id_karyawan_produksi",
        "fields": ["Id_karyawan_produksi", "Nama_pengguna", "Password", "No_telepon"],
    },
    {
        "entity": "Owner",
        "primary_key": "Id_owner",
        "fields": ["Id_owner", "Password", "Nama_Owner", "No_telepon"],
    },
    {
        "entity": "Jadwal_Produksi",
        "primary_key": "Id_jadwal_produksi",
        "fields": [
            "Id_jadwal_produksi",
            "Id_mrp",
            "Id_mps",
            "Id_produk",
            "Tanggal_mulai",
            "Tanggal_selesai",
            "Jam_mulai",
            "Jam_selesai",
            "Durasi_produksi",
        ],
    },
    {
        "entity": "Input_Penjualan_Produksi",
        "primary_key": "Id_input_penjualan",
        "fields": [
            "Id_input_penjualan",
            "Id_karyawan_produksi",
            "Id_toko",
            "Id_produk",
            "Tanggal_input",
            "Periode",
            "Jumlah_laku",
            "Keterangan",
        ],
    },
    {
        "entity": "Ramalan_Permintaan",
        "primary_key": "Id_ramalan_permintaan",
        "fields": [
            "Id_ramalan_permintaan",
            "Id_input_penjualan",
            "Id_produk",
            "Periode_ramalan",
            "Tanggal_ramalan",
            "Forecasted_demand",
        ],
    },
    {
        "entity": "Rute",
        "primary_key": "Id_rute",
        "fields": ["Id_rute", "Id_toko", "Id_lokasi_awal", "Id_lokasi_akhir", "Nama_rute", "Hari_kerja"],
    },
    {
        "entity": "Cluster",
        "primary_key": "Id_cluster",
        "fields": ["Id_cluster", "Id_toko", "Id_rute", "Id_produk", "Qty_kirim_pcs", "Qty_kirim_pcs_float", "Tanggal"],
    },
    {
        "entity": "Lokasi",
        "primary_key": "Id_lokasi",
        "fields": ["Id_lokasi", "Lokasi", "Nomor"],
    },
]


FUNCTIONAL_REQUIREMENTS = {
    "owner": {
        "input": ["Login dengan username dan password", "Mengganti password terbaru"],
        "output": ["Melihat laporan perencanaan produksi", "Melihat ramalan permintaan"],
    },
    "production": {
        "input": [
            "Login dengan username dan password",
            "Mengganti password terbaru",
            "Memasukkan data produk roti",
            "Memasukkan data stok bahan baku saat ini",
            "Memasukkan data supplier bahan baku",
            "Memasukkan pembaruan stok bahan baku",
        ],
        "output": [
            "Melihat ramalan permintaan roti",
            "Melihat material requirement planning",
            "Melihat master production schedule",
            "Melihat data pemesanan bahan baku",
            "Melihat penjadwalan pemesanan bahan baku",
            "Melihat bill of material setiap produk",
        ],
    },
    "marketing": {
        "input": [
            "Login dengan username dan password",
            "Mengganti password terbaru",
            "Memasukkan data kuantitas laku",
            "Memasukkan data toko atau retail tujuan",
        ],
        "output": ["Melihat data ramalan permintaan", "Melihat segmentasi toko"],
    },
    "processing": [
        "Mengolah data produk roti dan data toko menjadi kebutuhan produk roti",
        "Mengolah data bahan baku menjadi kebutuhan bahan baku dan bill of material",
        "Mengolah data kuantitas laku menjadi ramalan permintaan",
        "Mengolah data bahan baku dan stok menjadi material requirement planning",
        "Menghasilkan MPS, RCCP, MRP, CRP, penjadwalan produksi, dan rekomendasi pemesanan bahan baku",
    ],
    "storage": [
        "Menyimpan data ramalan permintaan produk",
        "Menyimpan bill of material produk",
        "Menyimpan stok bahan baku",
        "Menyimpan waktu proses dan setup produksi",
        "Menyimpan jadwal pemesanan bahan baku",
        "Menyimpan jadwal produksi",
    ],
    "control": [
        "Validasi input untuk menghindari data salah dan duplikasi",
        "Backup dan recovery data otomatis",
        "Log aktivitas pengguna untuk keamanan",
    ],
}


NON_FUNCTIONAL_REQUIREMENTS = [
    {
        "area": "Performance",
        "requirement": "Perhitungan rekomendasi MPS, MRP, dan ROP dapat diproses dalam waktu singkat.",
    },
    {
        "area": "Information",
        "requirement": "Sistem menampilkan informasi akurat, lengkap, dapat ditelusuri, dan diperbarui sesuai input operasional terbaru.",
    },
    {
        "area": "Economy",
        "requirement": "Sistem membantu mengurangi pemesanan berlebih, biaya simpan, dan keterlambatan produksi.",
    },
    {
        "area": "Control",
        "requirement": "Data biaya, supplier, stok, dan jadwal produksi hanya dapat diubah oleh user dengan hak akses tertentu.",
    },
    {
        "area": "Efficiency",
        "requirement": "Sistem mengurangi pencatatan manual dan mempercepat penyusunan jadwal produksi serta pembelian bahan baku.",
    },
    {
        "area": "Service",
        "requirement": "Antarmuka mudah digunakan, memiliki notifikasi keputusan, dan dapat dikembangkan untuk integrasi modul lain.",
    },
]


DEMAND_PAGE_KPIS = [
    {
        "kra": "Pengelolaan data peramalan",
        "indicator": "Ketersediaan data penjualan aktual untuk peramalan",
        "parameters": ["Input data laku produk", "Kelengkapan data historis penjualan", "Data historis penjualan per produk"],
    },
    {
        "kra": "Pemantauan performa model peramalan",
        "indicator": "Kemampuan evaluasi performa model peramalan",
        "parameters": ["Mean Absolute Error (MAE)", "Mean Squared Error (MSE)", "Root Mean Squared Error (RMSE)", "R Square"],
    },
    {
        "kra": "Evaluasi dan pemilihan model peramalan",
        "indicator": "Kemampuan perbandingan performa dan pemilihan model peramalan",
        "parameters": ["Perbandingan nilai error antar model", "Model peramalan terpilih", "Model dengan nilai error terbaik"],
    },
    {
        "kra": "Peramalan permintaan produk",
        "indicator": "Kemampuan menghasilkan prediksi permintaan",
        "parameters": ["Prediksi permintaan 20 hari ke depan", "Prediksi per kategori produk roti dan toko tujuan"],
    },
]


GENERAL_KPIS = [
    "Menghasilkan MPS untuk seluruh produk roti pada periode 20 hari ke depan",
    "Menghasilkan RCCP dengan perbandingan kapasitas tersedia dan kapasitas dibutuhkan",
    "Menghasilkan scheduling setiap proses produksi beserta waktu mulai dan selesai",
    "Menghasilkan MRP untuk kebutuhan bahan baku dan periode pemesanan",
    "Menghasilkan CRP detail untuk setiap proses produksi",
    "Dashboard dapat diakses stakeholder sesuai hak akses pengguna",
]


UI_TREE = {
    "owner": [
        "Halaman Login",
        "Menu Utama Owner",
        "Dashboard Laporan",
        "Halaman Laporan Pemesanan Bahan Baku",
        "Halaman Hasil Ramalan Permintaan",
    ],
    "production": [
        "Halaman Login",
        "Menu Utama Karyawan Produksi",
        "Menu Pemesanan Bahan Baku",
        "Halaman CRP",
        "Halaman MRP",
        "Menu Perencanaan Produksi",
        "Halaman Bill of Material",
        "Halaman Scheduling",
        "Halaman RCCP",
        "Halaman MPS",
        "Halaman Hasil Ramalan Permintaan",
        "Menu Input Data",
        "Halaman Data Produk",
        "Halaman Data Bahan Baku",
    ],
    "marketing": [
        "Halaman Login",
        "Menu Utama Karyawan Pemasaran",
        "Halaman Hasil Segmentasi Toko",
        "Halaman Hasil Ramalan Permintaan",
        "Menu Input Data",
        "Halaman Data Penjualan",
        "Halaman Data Supplier dan Toko",
    ],
}


def get_design_contract() -> dict[str, Any]:
    return {
        "source_document": "Coret2.docx",
        "data_stores": DFD_DATA_STORES,
        "data_dictionary": DATA_DICTIONARY,
        "functional_requirements": FUNCTIONAL_REQUIREMENTS,
        "non_functional_requirements": NON_FUNCTIONAL_REQUIREMENTS,
        "kpis": {
            "demand_page": DEMAND_PAGE_KPIS,
            "planning": GENERAL_KPIS,
        },
        "ui_tree": UI_TREE,
    }
