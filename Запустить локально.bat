@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo First install Python dependencies according to docs/installation-windows.md
  pause
  exit /b 1
)
.venv\Scripts\python.exe scripts\start_local.py
pause
