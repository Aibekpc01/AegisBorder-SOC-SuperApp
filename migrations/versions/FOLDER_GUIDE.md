# migrations/versions/

Миграции от начальных таблиц Command Center до ролей и DLP. upgrade меняет схему вперёд, downgrade описывает обратный переход.

Общая карта: [SOURCE_GUIDE.md](../../SOURCE_GUIDE.md).

Файлы непосредственно в этой папке:

- [001_command_center.py](001_command_center.py) — Изменение схемы БД: 001_command_center. Применяется Alembic в порядке связей revision/down_revision.
- [002_roles.py](002_roles.py) — Изменение схемы БД: 002_roles. Применяется Alembic в порядке связей revision/down_revision.
- [003_profiles_access.py](003_profiles_access.py) — Изменение схемы БД: 003_profiles_access. Применяется Alembic в порядке связей revision/down_revision.
- [004_workspace.py](004_workspace.py) — Изменение схемы БД: 004_workspace. Применяется Alembic в порядке связей revision/down_revision.
- [005_superapp.py](005_superapp.py) — Изменение схемы БД: 005_superapp. Применяется Alembic в порядке связей revision/down_revision.
- [006_team.py](006_team.py) — Изменение схемы БД: 006_team. Применяется Alembic в порядке связей revision/down_revision.
- [007_connectors.py](007_connectors.py) — Изменение схемы БД: 007_connectors. Применяется Alembic в порядке связей revision/down_revision.
- [008_presence.py](008_presence.py) — Изменение схемы БД: 008_presence. Применяется Alembic в порядке связей revision/down_revision.
- [009_roles.py](009_roles.py) — Изменение схемы БД: 009_roles. Применяется Alembic в порядке связей revision/down_revision.
- [010_dlp.py](010_dlp.py) — Изменение схемы БД: 010_dlp. Применяется Alembic в порядке связей revision/down_revision.
