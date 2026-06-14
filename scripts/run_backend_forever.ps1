$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot ".venv\Scripts\python.exe"
$supervisorLog = Join-Path $projectRoot "backend-supervisor.log"
$backendLog = Join-Path $projectRoot "backend.log"
$backendErr = Join-Path $projectRoot "backend.err"

Set-Location -LiteralPath $projectRoot

if (-not (Test-Path -LiteralPath $pythonPath)) {
    "$(Get-Date -Format s) backend supervisor gagal: python venv tidak ditemukan di $pythonPath" | Add-Content -LiteralPath $supervisorLog
    exit 1
}

while ($true) {
    "$(Get-Date -Format s) starting backend on http://127.0.0.1:8000" | Add-Content -LiteralPath $supervisorLog
    & $pythonPath -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 >> $backendLog 2>> $backendErr
    "$(Get-Date -Format s) backend stopped with exit code $LASTEXITCODE; restarting in 5s" | Add-Content -LiteralPath $supervisorLog
    Start-Sleep -Seconds 5
}
