@echo off
cd /d "%~dp0"
docker compose up --build -d --wait --wait-timeout 180
if errorlevel 1 (echo Ошибка запуска. Проверьте Docker Desktop и файл .env & pause & exit /b 1)
start "" http://127.0.0.1:8000
pause
