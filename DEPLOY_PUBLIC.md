# Deploy Publik Balimo Bakery DSS

Dokumen ini menyiapkan aplikasi agar bisa dipakai user dari internet, bukan hanya jaringan lokal.

## Arsitektur

- Satu web service menjalankan FastAPI.
- FastAPI melayani API di `/api/*`.
- FastAPI juga melayani frontend React hasil `npm run build` dari folder `dist/`.
- PostgreSQL berada di cloud/managed database.
- PostgreSQL tidak perlu diekspos langsung ke user publik.

## Opsi Cepat: Render Blueprint

1. Push repo ini ke GitHub.
2. Di Render, pilih **New > Blueprint**.
3. Pilih repo ini.
4. Render akan membaca `render.yaml` dan membuat:
   - web service `balimo-bakery-dss`
   - PostgreSQL database `balimo-bakery-db`
5. Tunggu build Docker selesai.

Setelah service dan database dibuat, database masih perlu diisi schema dan data.

## Inisialisasi Database Cloud

Jalankan perintah ini dari laptop yang punya akses ke file Excel final.

### 1. Set environment PostgreSQL cloud

PowerShell:

```powershell
$env:DSS_DB_HOST="your-postgres-host"
$env:DSS_DB_PORT="5432"
$env:DSS_DB_NAME="balimo_bakery_dss"
$env:DSS_DB_USER="balimo_bakery_dss"
$env:DSS_DB_PASSWORD="your-postgres-password"
$env:DSS_DB_SCHEMA="dss"
$env:DSS_SCENARIO_CODE="default"
$env:DSS_PSQL_PATH="D:\PostgreeSQL\bin\psql.exe"
```

Gunakan host, database, user, dan password dari provider cloud.

### 2. Buat schema runtime

```powershell
& $env:DSS_PSQL_PATH `
  -h $env:DSS_DB_HOST `
  -p $env:DSS_DB_PORT `
  -U $env:DSS_DB_USER `
  -d $env:DSS_DB_NAME `
  -v ON_ERROR_STOP=1 `
  -f database\runtime_schema.sql
```

### 3. Import data dari Excel final

```powershell
.\.venv\Scripts\python.exe -m backend.postgres_importer "D:\Download\Data_TA__FINAL.xlsx"
```

Importer akan mengisi:

- `dss.demand_plans` untuk forecast
- `dss.mps_lines` untuk MPS
- `dss.rccp_lines` untuk RCCP
- `dss.crp_lines` untuk CRP
- `dss.production_schedule_lines` untuk scheduling
- data master lain yang dibutuhkan dashboard

## Variabel Environment Web Service

Jika tidak memakai `render.yaml`, set env berikut pada web service:

```text
DSS_DB_HOST
DSS_DB_PORT
DSS_DB_NAME
DSS_DB_USER
DSS_DB_PASSWORD
DSS_DB_SCHEMA=dss
DSS_SCENARIO_CODE=default
DSS_PSQL_PATH=/usr/bin/psql
```

Untuk deploy satu domain, `DSS_CORS_ORIGINS` boleh dikosongkan karena frontend dan backend berada di origin yang sama.

## Verifikasi

Setelah deploy dan import data:

```text
https://your-domain/api/health
```

Harus mengembalikan:

```json
{"status":"ok"}
```

Lalu buka:

```text
https://your-domain/
```

## Catatan Keamanan

- Jangan expose port PostgreSQL ke publik untuk user biasa.
- User publik cukup mengakses domain web service.
- Simpan `DSS_DB_PASSWORD` hanya di environment provider, jangan commit ke Git.
