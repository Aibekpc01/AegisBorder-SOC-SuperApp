# Установка на Windows

Проверенная рабочая среда этой сессии: Node 24.21.0, Python 3.14.7, Docker CLI 29.8.2, Compose 5.6.0. Контейнер приложения использует Python 3.12. Точная редакция Windows не подтверждена инструментами, поэтому совместимость всех сборок Windows 10 не заявляется.

## Docker

Проверить совместимость своей редакции Windows с Docker Desktop по официальной документации: https://docs.docker.com/desktop/setup/install/windows-install/. Включить поддерживаемый WSL 2 и аппаратную виртуализацию. Использовать Linux-контейнеры.

Существующий .env сохраняйте. Только при отсутствии файла скопируйте .env.example. Заполните DB_PASSWORD, ADMIN_PASSWORD (≥12 символов), AUDIT_KEY (≥32). В DB_PASSWORD используйте буквы и цифры: строка подключения не экранирует специальные символы.

```powershell
docker compose up --build -d --wait --wait-timeout 240
docker compose ps
curl.exe http://127.0.0.1:8000/api/v1/health
```

Открыть http://127.0.0.1:8000. Вход admin, ADMIN_PASSWORD из .env при первоначальном создании пользователя Command Center. Менять пароль существующего пользователя заменой .env нельзя.

Остановка: `docker compose down`. Не добавлять -v: он удалит том БД. Логи: `docker compose logs --tail=100 app db`.

## Без Docker

Установить совместимые Python и Node. Для новой установки рекомендуется Python 3.12; текущие зависимости также установлены на доступном Python 3.14. Установка требует интернета.

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.lock-windows.txt
powershell -NoProfile -File scripts/build_local.ps1
.venv/Scripts/python.exe scripts/start_local.py
```

Скрипт читает .env. Если DATABASE_URL не задан, используется SQLite в aegisborder_local.db. Для сервера PostgreSQL задайте DATABASE_URL в окружении или .env. Docker и локальный сервер не могут одновременно занимать 8000: остановите один из них.

Для разработки отдельно: backend через start_local.py, frontend `npm.cmd run dev` из frontend на http://127.0.0.1:5173. Vite проксирует API и WebSocket.

Версии frontend зафиксированы в package-lock.json. Python: requirements.lock-linux.txt для контейнера, requirements.lock-windows.txt для проверенного Windows-окружения. Базовые образы закреплены digest. Обновление зависимостей выполняйте с повторением проверок.

Windows 8/8.1 не проверялись. Docker на них не требуется и не рекомендуется. Возможный ограниченный вариант — браузерный клиент с backend на поддерживаемом сервере, после реального тестирования браузера, TLS и сборки JS. Текущая сборка не заявлена совместимой с устаревшими браузерами.
