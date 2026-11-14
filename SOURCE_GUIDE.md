# Как устроен исходный код AegisBorder

Этот комплект соответствует восстановленной версии r7 с Aegis DLP 2.0 и прежним синим интерфейсом. Пояснения добавлены к существующей структуре: пути импортов и поведение приложения сохранены.

## С чего начать

1. `app/main.py` → `app/command/api.py`: запуск серверного приложения и подключение маршрутов.
2. `frontend/src/main.tsx` → `command-center.tsx`: запуск интерфейса и выбор рабочего экрана.
3. `frontend/src/api.ts` → `/api/v1/...`: обмен браузера с сервером.
4. `app/command/models.py` и `migrations/versions/`: данные и история изменения схемы.
5. `app/command/dlp.py`, `dlp_gate.py`, `agents/windows-native/AegisDLP.cs`: полный путь подключения DLP.

## Папки

| Папка | За что отвечает |
|---|---|
| [app/](app/FOLDER_GUIDE.md) | Сервер на Python. main.py — текущий вход, legacy_main.py — сохранённый прототип, command/ — рабочая логика. |
| [app/command/](app/command/FOLDER_GUIDE.md) | Серверные маршруты, модели БД, авторизация, обработка событий и DLP. Начните с api.py, models.py и security.py. |
| [app/static/](app/static/FOLDER_GUIDE.md) | Статическая HTML-страница прежней поставки. Основной React-интерфейс собирается из frontend/. |
| [agents/](agents/FOLDER_GUIDE.md) | Исходники Windows-агентов. windows-native/ — нативная служба Aegis DLP 2.0; windows/ — Python-вариант. |
| [agents/windows-native/](agents/windows-native/FOLDER_GUIDE.md) | Нативный Aegis DLP на C#/.NET Framework: служба, трей, локальный HTTP-мост и установка. EXE получается через build.ps1. |
| [agents/windows/](agents/windows/FOLDER_GUIDE.md) | Python-вариант агента и установочные сценарии. Не следует смешивать его с требованиями к нативной службе 2.0. |
| [frontend/](frontend/FOLDER_GUIDE.md) | Клиент на React и TypeScript. package.json задаёт зависимости и команды dev/build/test, Vite собирает браузерные файлы. |
| [frontend/src/](frontend/src/FOLDER_GUIDE.md) | Исходники интерфейса. main.tsx запускает приложение, command-center.tsx собирает рабочую оболочку, api.ts обращается к серверу. |
| [frontend/src/components/](frontend/src/components/FOLDER_GUIDE.md) | Компоненты страниц и общие элементы интерфейса. DLP сосредоточен в dlp-workspace.tsx и dlp-required.tsx. |
| [frontend/src/components/ui/](frontend/src/components/ui/FOLDER_GUIDE.md) | Небольшие общие элементы: кнопки и диалоги. Не содержат серверных правил доступа. |
| [frontend/src/lib/](frontend/src/lib/FOLDER_GUIDE.md) | Клиентские справочники, маршруты и общие функции. dlp-proof.ts связывает браузер с локальной службой. |
| [frontend/src/assets/](frontend/src/assets/FOLDER_GUIDE.md) | Изображения, эмблемы и другие ресурсы, которые Vite включает в сборку. |
| [frontend/src/assets/story/](frontend/src/assets/story/FOLDER_GUIDE.md) | Иллюстрации учебной истории: злоумышленник и оператор центра безопасности. |
| [frontend/e2e/](frontend/e2e/FOLDER_GUIDE.md) | Браузерные проверки Playwright: открытие страниц, действия пользователя и состояние интерфейса. |
| [frontend/scripts/](frontend/scripts/FOLDER_GUIDE.md) | Служебные браузерные проверки отдельных выпусков. Сценарии могут требовать работающий сервер и тестовые учётные данные. |
| [migrations/](migrations/FOLDER_GUIDE.md) | Изменения структуры базы через Alembic. env.py подключает БД, versions/ содержит последовательные версии схемы. |
| [migrations/versions/](migrations/versions/FOLDER_GUIDE.md) | Миграции от начальных таблиц Command Center до ролей и DLP. upgrade меняет схему вперёд, downgrade описывает обратный переход. |
| [scripts/](scripts/FOLDER_GUIDE.md) | Команды разработчика и администратора: запуск, упаковка, резервирование, восстановление доступа и приём внешних событий. |
| [tests/](tests/FOLDER_GUIDE.md) | Серверные и интеграционные проверки. conftest.py готовит окружение; test_*.py проверяют отдельные подсистемы. |
| [deploy/](deploy/FOLDER_GUIDE.md) | Конфигурация размещения приложения. Oracle-конфигурация прокси находится в oracle/. |
| [deploy/oracle/](deploy/oracle/FOLDER_GUIDE.md) | Настройка Caddy перед приложением: HTTPS и передача запросов внутреннему сервису. |
| [docs/](docs/FOLDER_GUIDE.md) | Руководства пользователя и разработчика, описание API, схемы БД и исторические отчёты выпусков. Дата отчёта определяет, к какому выпуску он относится. |

## Как связаны основные части

Вход: форма в браузере отправляет запрос через `api.ts`. Сервер проверяет пароль в `security.py`, создаёт запись сеанса и выдаёт подписанный токен. Следующие запросы проверяются по роли, сетевой политике и, если есть назначение, состоянию DLP.

События: источник или агент передаёт JSON. `schemas.py` проверяет поля, `detection.py` сохраняет событие и ищет совпадения по правилам. Предупреждения и связанные инциденты читаются интерфейсом. Учебные события создаются отдельно через `scenarios.py`.

DLP: пользователь получает персональный ZIP через `dlp.py`. Windows-служба регистрируется и отправляет heartbeat. Браузер получает короткоживущий код и передаёт его службе через `dlp-proof.ts`. `dlp_gate.py` проверяет привязку сеанса, свежесть связи и применение политики. Сам переключатель в интерфейсе не доказывает работу службы.

Данные: модели SQLAlchemy задают таблицы; Alembic хранит историю схемы. Изменение модели само по себе не заменяет миграцию. На действующем сервере схема сохранена при откате, поэтому конфигурацию запуска нужно сверять с установленными миграциями.

Размещение: Dockerfile собирает React и Python-приложение. Compose связывает приложение с PostgreSQL, Caddy публикует HTTPS. Рабочие пароли задаются через окружение.

## Файлы в корне

- `Dockerfile` — сборка браузерной части и серверного образа.
- `compose*.yaml` — варианты запуска контейнеров: локальный, Oracle, офлайн и публичная демонстрация.
- `requirements*.txt` — зависимости Python; `frontend/package.json` и `package-lock.json` — зависимости JavaScript.
- `alembic.ini` — конфигурация миграций; `pyproject.toml` — параметры Python-инструментов.
- `.env.example`, `.env.oracle.example` — шаблоны окружения без рабочих секретов.
- `Запустить*.bat`, `Остановить.bat` — команды локального запуска и остановки.

## Что не входит в архив

Рабочие `.env`, базы SQLite, PostgreSQL-дампы, ключи доступа, каталоги зависимостей, кэши, исторические поставки и собранные EXE исключены. Нативный EXE можно собрать из `agents/windows-native/AegisDLP.cs` через `build.ps1`. Исходные изображения интерфейса включены. Папки `release/`, `backups/`, `.venv/` и `frontend/node_modules/` относятся к локальному окружению и результатам сборки.

## Проверка и повторная упаковка

Клиент: `cd frontend`, затем `npm.cmd ci`, `npm.cmd run build`, `npm.cmd run test`. Сервер: установить зависимости из requirements-файлов и выполнить `python -m pytest`. Windows-служба собирается в Windows через её `build.ps1`.

Повторная упаковка: `python scripts/package_documented_source.py`. Архив появляется в `release/documented-source/`. Внутри `SOURCE_MANIFEST.json` содержит размер и SHA-256 каждого включённого файла.

Подробный указатель функций и классов: [docs/SOURCE_FILES.md](docs/SOURCE_FILES.md). Исторические отчёты в docs/ описывают свои выпуски и не заменяют эту карту текущих исходников.
