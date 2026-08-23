<#
.SYNOPSIS
    IntelliClass AI - Windows PowerShell One-Click Launcher with Health Monitor
.DESCRIPTION
    Launches Next.js Frontend (:3000), HeadTTS (:8882), and FastAPI AI Backend (:8000).
#>

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting IntelliClass AI Polyglot Monorepo Stack..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Verify Node & pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ pnpm is not installed. Please run: npm install -g pnpm" -ForegroundColor Red
    exit 1
}

# 1. Start HeadTTS in separate process
Write-Host "🎙️ Launching HeadTTS Microservice (Port 8882)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$RootDir/HeadTTS'; Write-Host '--- HeadTTS Microservice (8882) ---' -ForegroundColor Magenta; pnpm start"

# 2. Start Python AI Backend in separate process
Write-Host "🧠 Launching Python AI Backend (Port 8000)..." -ForegroundColor Yellow
$AiVenv = "$RootDir/ai-backend/.venv/Scripts/Activate.ps1"
if (Test-Path $AiVenv) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$RootDir/ai-backend'; & '$AiVenv'; Write-Host '--- AI Backend (:8000) ---' -ForegroundColor Yellow; python -m uvicorn main:app --reload --port 8000"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$RootDir/ai-backend'; Write-Host '--- AI Backend (:8000) ---' -ForegroundColor Yellow; python -m uvicorn main:app --reload --port 8000"
}

# 3. Start Next.js Frontend
Write-Host "💻 Launching Next.js 16 Frontend Studio (Port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$RootDir/model-next'; Write-Host '--- Frontend Studio (:3000) ---' -ForegroundColor Cyan; pnpm dev"

Write-Host ""
Write-Host "⏳ Waiting 5 seconds for service boot before polling health endpoints..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Run Health Check script
node "$RootDir/scripts/health-check.mjs"
