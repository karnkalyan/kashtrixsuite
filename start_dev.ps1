# Kashtrix Broadcast Suite v2 — Local Development Startup (Prisma ORM + MySQL + Local MediaMTX)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$env:PRISMA_DATABASE_URL = "mysql://root:@127.0.0.1:3306/kashtrix"
$env:DATABASE_URL = "mysql+pymysql://root:@127.0.0.1:3306/kashtrix?charset=utf8mb4"
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "KashtrixAdmin2026!"
$env:PLAYOUT_DRY_RUN = "0"
$env:MEDIAMTX_DIR = "C:\Users\karnk\Downloads\mediamtx_v1.21.3_windows_amd64"
$env:MEDIAMTX_BIN = "C:\Users\karnk\Downloads\mediamtx_v1.21.3_windows_amd64\mediamtx.exe"
$env:INGEST_URL = "rtmp://127.0.0.1:1935/channel1"
$env:SOURCE_URL = "rtmp://127.0.0.1:1935/channel1"
$env:HLS_ORIGIN = "http://127.0.0.1:8888"
$env:PATH = "$env:APPDATA\Python\Python313\Scripts;C:\ffmpeg\bin;$env:PATH"

Write-Host "1. Syncing MySQL schema with Prisma ORM..." -ForegroundColor Cyan
python -m prisma db push --schema=prisma/schema.prisma
python -m prisma generate --schema=prisma/schema.prisma

Write-Host "2. Ensuring MediaMTX (C:\Users\karnk\Downloads\mediamtx_v1.21.3_windows_amd64) is running..." -ForegroundColor Cyan
$mtxRunning = Get-NetTCPConnection -LocalPort 1935 -State Listen -ErrorAction SilentlyContinue
if (-not $mtxRunning -and (Test-Path $env:MEDIAMTX_BIN)) {
    Start-Process -FilePath $env:MEDIAMTX_BIN -ArgumentList "$Root\deploy\mediamtx.yml" -WorkingDirectory $env:MEDIAMTX_DIR -WindowStyle Hidden
    Start-Sleep -Seconds 1
}

Write-Host "3. Starting FastAPI backend on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Start-Process -FilePath "python" -ArgumentList "-m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --workers 1" -WorkingDirectory $Root -WindowStyle Hidden

Write-Host "4. Starting Vite React frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Set-Location "$Root\frontend"
npm run dev

