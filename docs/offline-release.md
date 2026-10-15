# Локальный релиз и запуск без сети

Пакет — учебная версия с синтетическими событиями. Реальные Microsoft 365, Kaspersky и DLP не подключены. Нужны уже установленный Docker Desktop с Linux-контейнерами и современный браузер. Чистая установка на другом компьютере пока не подтверждена.

Сборка пакета на компьютере разработки после проверки и обновления контейнера:

```powershell
.venv/Scripts/python.exe scripts/package_release.py --with-images
```

Каталог `release` содержит архив приложения, `docker-images.tar` и SHA-256 файлов. Внутри ZIP есть MANIFEST.json с контрольными суммами включённых файлов. Секреты, базы и дампы не включаются. Docker-образы содержат код и зависимости, а не данные действующей базы.

На целевом компьютере проверьте SHA-256 командой `Get-FileHash`, распакуйте ZIP, загрузите образы и создайте `.env` по `.env.example`. Задайте собственные DB_PASSWORD, ADMIN_PASSWORD и AUDIT_KEY. Для переноса действующей базы сохраните её исходный AUDIT_KEY отдельно.

```powershell
docker load -i docker-images.tar
docker compose -f compose.yaml -f compose.offline.yaml up -d --no-build --pull never --wait --wait-timeout 240
curl.exe http://127.0.0.1:8000/api/v1/health
```

Открыть http://127.0.0.1:8000/app. Для остановки используйте те же два compose-файла и `stop`. Не добавляйте `-v`: том содержит базу.

Восстановление доступа: [admin-recovery.md](admin-recovery.md). Проверки: [testing-results.md](testing-results.md). Пакет не устанавливает Docker или браузер и не заменяет независимую приёмку.
