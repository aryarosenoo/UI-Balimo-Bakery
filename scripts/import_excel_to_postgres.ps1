param(
    [string]$WorkbookPath = "Data TA\Data TA (version 2) COPY.xlsx"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

if (-not $env:DSS_DB_HOST) { $env:DSS_DB_HOST = "127.0.0.1" }
if (-not $env:DSS_DB_PORT) { $env:DSS_DB_PORT = "5432" }
if (-not $env:DSS_DB_NAME) { $env:DSS_DB_NAME = "balimo_bakery_dss" }
if (-not $env:DSS_DB_USER) { $env:DSS_DB_USER = "postgres" }
if (-not $env:DSS_DB_SCHEMA) { $env:DSS_DB_SCHEMA = "dss" }
if (-not $env:DSS_SCENARIO_CODE) { $env:DSS_SCENARIO_CODE = "default" }
if (-not $env:DSS_PSQL_PATH) { $env:DSS_PSQL_PATH = "D:\PostgreeSQL\bin\psql.exe" }

if (-not (Test-Path -LiteralPath $env:DSS_PSQL_PATH)) {
    throw "psql tidak ditemukan di $env:DSS_PSQL_PATH"
}

$passwordWasSet = [bool]$env:DSS_DB_PASSWORD
if (-not $passwordWasSet) {
    $securePassword = Read-Host "Password PostgreSQL untuk user $env:DSS_DB_USER" -AsSecureString
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $env:DSS_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}

$env:PGPASSWORD = $env:DSS_DB_PASSWORD

try {
    & $env:DSS_PSQL_PATH `
        -h $env:DSS_DB_HOST `
        -p $env:DSS_DB_PORT `
        -U $env:DSS_DB_USER `
        -d $env:DSS_DB_NAME `
        -v ON_ERROR_STOP=1 `
        -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

    if ($LASTEXITCODE -ne 0) {
        throw "Extension pgcrypto belum bisa disiapkan."
    }

    $schemaProbe = & $env:DSS_PSQL_PATH `
        -h $env:DSS_DB_HOST `
        -p $env:DSS_DB_PORT `
        -U $env:DSS_DB_USER `
        -d $env:DSS_DB_NAME `
        -tA `
        -c "SELECT CASE WHEN to_regclass('dss.planning_scenarios') IS NULL THEN 'missing' ELSE 'ready' END;"

    if ($LASTEXITCODE -ne 0) {
        throw "Koneksi PostgreSQL gagal. Periksa host, database, user, dan password."
    }

    if (($schemaProbe | Select-Object -Last 1).Trim() -eq "missing") {
        Write-Host "Schema runtime belum lengkap. Menjalankan database/runtime_schema.sql..."
        & $env:DSS_PSQL_PATH `
            -h $env:DSS_DB_HOST `
            -p $env:DSS_DB_PORT `
            -U $env:DSS_DB_USER `
            -d $env:DSS_DB_NAME `
            -v ON_ERROR_STOP=1 `
            -f "database\runtime_schema.sql"

        if ($LASTEXITCODE -ne 0) {
            throw "Pembuatan schema runtime gagal."
        }
    }

    Write-Host "Import workbook ke PostgreSQL: $WorkbookPath"
    .\.venv\Scripts\python.exe -m backend.postgres_importer $WorkbookPath

    if ($LASTEXITCODE -ne 0) {
        throw "Import workbook ke PostgreSQL gagal."
    }

    Write-Host "Import selesai. Jalankan ulang backend agar membaca data terbaru."
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if (-not $passwordWasSet) {
        Remove-Item Env:DSS_DB_PASSWORD -ErrorAction SilentlyContinue
    }
}
