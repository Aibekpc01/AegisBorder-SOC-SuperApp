# Назначение файла: Подключает Alembic к конфигурации SQLAlchemy и запускает миграции схемы базы данных.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

from alembic import context

from app.command import (
    models,  # noqa: F401
    superapp_models,  # noqa: F401
)
from app.command.db import Base, engine

with engine.connect() as connection:
    context.configure(
        connection=connection, target_metadata=Base.metadata, version_table="cc_alembic_version"
    )
    with context.begin_transaction():
        context.run_migrations()
