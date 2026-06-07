@echo off
title NEXTLEVEL Launcher
echo ============================================
echo   NEXTLEVEL - local launcher
echo ============================================
echo.

if not exist node_modules (
  echo [1/3] Installing frontend dependencies...
  call npm install
)
if not exist backend\node_modules (
  echo [2/3] Installing backend dependencies...
  pushd backend
  call npm install
  popd
)

echo [3/3] Starting backend (port 5000) and frontend (port 3000)...
start "NEXTLEVEL Backend" cmd /k "cd backend && npm run dev"
timeout /t 4 >nul
start "NEXTLEVEL Frontend" cmd /k "npm run dev"

echo.
echo Done. The app will open at http://localhost:3000
echo (Two new windows opened - close them to stop the servers.)
