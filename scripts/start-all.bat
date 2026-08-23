@echo off
title IntelliClass AI Launcher
cd /d "%~dp0\.."

echo ========================================================
echo   Starting IntelliClass AI Polyglot Monorepo Stack...
echo ========================================================

echo [1/3] Launching HeadTTS Microservice (8882)...
start "HeadTTS (:8882)" cmd /k "cd /d HeadTTS && pnpm start"

echo [2/3] Launching Python AI Backend (8000)...
if exist "ai-backend\.venv\Scripts\activate.bat" (
    start "AI Backend (:8000)" cmd /k "cd /d ai-backend && call .venv\Scripts\activate.bat && python -m uvicorn main:app --reload --port 8000"
) else (
    start "AI Backend (:8000)" cmd /k "cd /d ai-backend && python -m uvicorn main:app --reload --port 8000"
)

echo [3/3] Launching Next.js Frontend Studio (3000)...
start "Frontend Studio (:3000)" cmd /k "cd /d model-next && pnpm dev"

echo.
echo All services launched! Checking health status in 5 seconds...
timeout /t 5 /nobreak >nul
node scripts\health-check.mjs

pause
