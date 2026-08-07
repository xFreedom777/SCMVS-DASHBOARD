@echo off
title SCMVS Real-time Dashboard Server
color 0a

echo ===================================================
echo   Starting SCMVS Real-time Dashboard (v2.0)
echo ===================================================

:: Check if node_modules exists, if not, run npm install
if not exist "node_modules\" (
    echo [INFO] Installing required dependencies for the first time...
    call npm install
)

echo.
echo [INFO] Starting Node.js Server...
node server.js

pause
