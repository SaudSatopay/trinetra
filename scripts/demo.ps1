# Trinetra one-command demo launcher (Windows / PowerShell).
# Starts the backend (FastAPI) and frontend (Next.js dev), then opens the control room.
#
#   powershell -ExecutionPolicy Bypass -File scripts\demo.ps1
#
# Tip: set $env:TRINETRA_DEMO_MODE = "1" before running for instant cached AI
# (skips the live model path) while recording the demo.

$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = "1"                              # UTF-8 stdio so harness banners don't mojibake on cp1252
$root = Split-Path -Parent $PSScriptRoot          # repo root (scripts/ -> ..)
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$py = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

Write-Host "Starting Trinetra backend on :8000 ..." -ForegroundColor Cyan
Start-Process -FilePath $py `
  -ArgumentList "-m", "uvicorn", "app.api.server:app", "--app-dir", $backend, "--port", "8000", "--host", "127.0.0.1" `
  -WorkingDirectory $backend

Write-Host "Starting Trinetra frontend on :3000 ..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "npm run dev" -WorkingDirectory $frontend

Write-Host "Waiting for servers to come up ..." -ForegroundColor Cyan
Start-Sleep -Seconds 9
Start-Process "http://localhost:3000"
Write-Host "Trinetra is up -> http://localhost:3000  (API: http://127.0.0.1:8000)" -ForegroundColor Green
