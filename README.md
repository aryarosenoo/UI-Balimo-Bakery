# Bakery DSS Dashboard

Dashboard ini menghubungkan frontend React dengan backend FastAPI. Runtime backend memakai PostgreSQL schema `dss` sebagai sumber data utama, sesuai rancangan database DSS Balimo Bakery.

## Fitur

- Dashboard ringkas produksi dan kapasitas
- Forecast demand dari tabel PostgreSQL
- Tabel MPS mingguan
- MRP per produk dan komponen
- Kapasitas RCCP/CRP berbasis work center dan routing
- Output jadwal produksi dan distribusi
- Mapping rute dan toko

## Struktur

- `scheduling.jsx`: komponen frontend utama
- `src/`: entry Vite dan stylesheet
- `backend/`: API FastAPI berbasis PostgreSQL
- `database/runtime_schema.sql`: schema PostgreSQL runtime
- `backend/postgres_importer.py`: script import awal dari workbook ke PostgreSQL

## Konfigurasi Database

Backend membaca konfigurasi PostgreSQL dari environment:

```powershell
$env:DSS_DB_HOST="127.0.0.1"
$env:DSS_DB_PORT="5432"
$env:DSS_DB_NAME="balimo_bakery_dss"
$env:DSS_DB_USER="postgres"
$env:DSS_DB_PASSWORD="password-postgres-anda"
$env:DSS_DB_SCHEMA="dss"
$env:DSS_SCENARIO_CODE="default"
$env:DSS_PSQL_PATH="D:\PostgreeSQL\bin\psql.exe"
```

Jika `DSS_DB_PASSWORD` atau `PGPASSWORD` belum diset, login dan endpoint data akan gagal karena backend tidak bisa membuka PostgreSQL.

## Menjalankan Backend

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload
```

Healthcheck:

```text
http://127.0.0.1:8000/api/health
http://127.0.0.1:8000/api/database/status
```

## Menjalankan Frontend

```powershell
npm install
npm run dev
```

Frontend Vite memanggil backend melalui proxy `/api` ke `http://127.0.0.1:8000`.

## Input Data

Runtime aplikasi tidak membaca Excel. Data operasional dibaca dari tabel PostgreSQL seperti `dss.demand_plans`, `dss.mps_lines`, `dss.mrp_lines`, `dss.rccp_lines`, `dss.crp_lines`, `dss.production_schedule_lines`, `dss.bom_versions`, dan `dss.bom_lines`.

Workbook Excel hanya dipakai sebagai sumber import awal jika database perlu diisi ulang:

```powershell
.\.venv\Scripts\python.exe -m backend.postgres_importer "D:\Download\Data_TA__FINAL.xlsx"
```

Untuk lokal, pakai script berikut agar password PostgreSQL diminta aman lewat prompt dan schema runtime dicek otomatis:

```powershell
.\scripts\import_excel_to_postgres.ps1
```

Setelah import selesai, backend memakai PostgreSQL untuk login, dashboard, forecast, MPS, MRP, RCCP, CRP, BOM, dan scheduling.
