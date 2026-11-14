# Назначение файла: Точка входа Uvicorn. Экспортирует приложение из app.command.api; прежний прототип находится в legacy_main.py.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Точка входа Command Center. Прототип сохранён в legacy_main.py."""

from .command.api import app

__all__ = ["app"]
