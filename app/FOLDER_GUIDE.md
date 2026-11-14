# app/

Сервер на Python. main.py — текущий вход, legacy_main.py — сохранённый прототип, command/ — рабочая логика.

Общая карта: [SOURCE_GUIDE.md](../SOURCE_GUIDE.md).

Файлы непосредственно в этой папке:

- [__init__.py](__init__.py) — Обозначает Python-пакет для импорта соседних модулей.
- [command/](command/FOLDER_GUIDE.md) — Серверные маршруты, модели БД, авторизация, обработка событий и DLP. Начните с api.py, models.py и security.py.
- [legacy_main.py](legacy_main.py) — Сохранённый ранний прототип. Текущий запуск через app.main использует Command Center.
- [main.py](main.py) — Точка входа Uvicorn. Экспортирует приложение из app.command.api; прежний прототип находится в legacy_main.py.
- [static/](static/FOLDER_GUIDE.md) — Статическая HTML-страница прежней поставки. Основной React-интерфейс собирается из frontend/.
