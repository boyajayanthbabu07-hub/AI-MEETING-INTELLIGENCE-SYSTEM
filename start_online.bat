@echo off
title AI Meeting Intelligence - Permanent Link Launcher
cd /d "%~dp0"

echo ========================================================
echo       AI MEETING INTELLIGENCE - STARTING SERVICES
echo ========================================================
echo.

echo [1/3] Starting Backend Server (Flask + Whisper)...
start "AI Meeting Backend" cmd /k "venv\Scripts\python backend\app\main.py"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Frontend Server (Vite)...
start "AI Meeting Frontend" cmd /k "cd frontend && npx vite --host 0.0.0.0 --port 5173"

timeout /t 3 /nobreak >nul

echo [3/3] Starting Permanent Link (LocalTunnel)...
echo.
echo ========================================================
echo   YOUR PERMANENT URL:
echo   https://ai-meeting-intelligence.loca.lt
echo ========================================================
echo.

npx localtunnel --port 5173 --subdomain ai-meeting-intelligence

pause
