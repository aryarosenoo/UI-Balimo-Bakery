# Bakery DSS Dashboard

Dashboard ini menghubungkan frontend React dengan backend FastAPI untuk membaca workbook Excel dari folder `Data TA`, lalu menampilkan:

- Dashboard ringkas produksi dan kapasitas
- Tabel MPS mingguan
- MRP sederhana per produk dan komponen
- Kapasitas work center berbasis routing
- Output jadwal produksi dan distribusi
- Mapping rute dan toko

## Struktur

- `scheduling.jsx`: komponen frontend utama
- `src/`: entry Vite dan stylesheet
- `backend/`: API FastAPI + loader workbook Excel
- `Data TA/`: lokasi input data `.xlsx`

## Menjalankan Backend

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

## Menjalankan Frontend

```bash
npm install
npm run dev
```

Frontend Vite akan memanggil backend melalui proxy `/api` ke `http://127.0.0.1:8000`.

## Input Data

Tempatkan file Excel `.xlsx` di folder `Data TA`. Sistem akan otomatis mengambil file terbaru dari folder tersebut. Untuk kompatibilitas awal, file workbook yang sudah ada juga disalin ke sana.

## Catatan Asumsi

- Sheet `Master Production Schedule` dipakai sebagai sumber produksi mingguan utama.
- Perhitungan MRP di dashboard memakai kebijakan sederhana `LFL` dengan stok awal `0`, safety stock `0`, lot size `1`, dan lead time `0`.
- Perhitungan kapasitas memakai `run time` per unit dan menambahkan `setup time` sekali tiap minggu jika ada produksi pada work center terkait.
