# scripts/

Команды разработчика и администратора: запуск, упаковка, резервирование, восстановление доступа и приём внешних событий.

Общая карта: [SOURCE_GUIDE.md](../SOURCE_GUIDE.md).

Файлы непосредственно в этой папке:

- [assign_creator.py](assign_creator.py) — Назначает учётной записи роль создателя через административный сценарий.
- [backup_oracle.py](backup_oracle.py) — Создаёт резервную копию серверной базы и проверяет параметры подключения.
- [build_local.ps1](build_local.ps1) — Собирает локальную поставку приложения через PowerShell.
- [create_oracle_env.py](create_oracle_env.py) — Готовит конфигурацию окружения для размещения на Oracle.
- [create_public_demo_env.py](create_public_demo_env.py) — Готовит окружение для публичной демонстрации.
- [forward_events.py](forward_events.py) — Пересылает события из внешнего источника в API приложения.
- [package_documented_source.py](package_documented_source.py) — Собирает архив исходников с пояснениями и SHA-256-манифестом; исключает рабочие .env, базы, зависимости и сборки.
- [package_release.py](package_release.py) — Собирает поставку приложения по разрешённому списку файлов и добавляет сведения для проверки комплекта.
- [prepare_render_source.py](prepare_render_source.py) — Подготавливает исходники для размещения на Render.
- [preview_ultra.py](preview_ultra.py) — Запускает отдельное локальное окружение для просмотра интерфейса.
- [public_demo_smoke.js](public_demo_smoke.js) — Выполняет базовую браузерную проверку публичной демонстрации.
- [pull_m365_audit.py](pull_m365_audit.py) — Получает аудит Microsoft 365 и передаёт события в приложение при настроенных учётных данных.
- [recover_admin.py](recover_admin.py) — Восстанавливает административный доступ через служебную команду.
- [set_public_origin.py](set_public_origin.py) — Настраивает публичный адрес приложения.
- [start_local.py](start_local.py) — Готовит и запускает локальное приложение на компьютере разработчика.
- [verify_ultra_image.py](verify_ultra_image.py) — Проверяет собранный образ приложения.
