@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
node scripts\setup-all.mjs
if errorlevel 1 (
  echo.
  echo Setup stopped. Read the error above. Your database has not been deleted.
  pause
  exit /b 1
)
endlocal
