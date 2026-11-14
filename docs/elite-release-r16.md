# Релиз r16 «Цифровой рубеж» на Oracle

14 ноября 2026 года, по прямому запросу владельца. Адрес: https://aegisborder.130.61.214.154.sslip.io/.

## Что развернуто

- Код ветки `main` (коммит `215ec40`): редизайн, дизайн-система, заголовки безопасности, сжатие статики, исправления лимитов входа за прокси и проверки иерархии в разделе сотрудников.
- Образ `aegisborder-elite:20261114-r16` (ARM64). Собран поверх прежнего проверенного образа `aegisborder-design:20261017-r15`: Python-зависимости не менялись, заменены код `app/`, `migrations/`, `scripts/`, `agents/` и собранный интерфейс.
- Исходники релиза: `/home/ubuntu/aegisborder-releases/elite-20261114-r16`; рабочий каталог обновлён теми же файлами (кроме `compose.oracle.yaml` и `.env`).
- Обновлён только контейнер `app`. PostgreSQL и его том, Caddy, сертификаты, домен и `.env` не менялись. Схема БД осталась `010_dlp`.

## Резервная копия и проверки

- `/home/ubuntu/aegisborder-backups/elite-20261114-r16`: дамп PostgreSQL (проверен `pg_restore --list`), прежние `compose*.yaml`, `.env`, исходники, ID прежнего образа.
- Перед переключением новый образ запускался на `127.0.0.1:18126` с рабочей базой: health, главная и экран входа без ошибок консоли и CSP.
- После переключения: отпечатки всех учётных записей (логин, хеш пароля, роль, активность) и сообщений чата совпадают с исходными; app/db healthy; HTTPS-главная и вход открываются на 1440 и 390 px без ошибок; приходят CSP и HSTS.

## Откат

```bash
cd /home/ubuntu/aegisborder-soc/AegisBorder_SOC_v0.2
sudo cp -p /home/ubuntu/aegisborder-backups/elite-20261114-r16/compose.oracle.yaml compose.oracle.yaml
sudo docker compose -p aegisborder_soc_v02 -f compose.yaml -f compose.oracle.yaml up -d --no-build --no-deps --wait app
```

Прежний образ также сохранён под тегом `aegisborder-elite:rollback-r16`. База при откате не меняется; не использовать `down -v`.
