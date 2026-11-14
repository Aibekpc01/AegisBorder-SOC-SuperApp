# migrations/

Изменения структуры базы через Alembic. env.py подключает БД, versions/ содержит последовательные версии схемы.

Общая карта: [SOURCE_GUIDE.md](../SOURCE_GUIDE.md).

Файлы непосредственно в этой папке:

- [env.py](env.py) — Подключает Alembic к конфигурации SQLAlchemy и запускает миграции схемы базы данных.
- [versions/](versions/FOLDER_GUIDE.md) — Миграции от начальных таблиц Command Center до ролей и DLP. upgrade меняет схему вперёд, downgrade описывает обратный переход.
