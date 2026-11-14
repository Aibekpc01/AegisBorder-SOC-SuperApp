# Указатель исходных файлов

Назначение каждого файла и имена его основных функций, классов или экспортов. Комментарии в ключевых модулях объясняют этапы обработки. Имена ниже помогают найти точную реализацию через поиск в редакторе.

## [agents/windows/console.py](../agents/windows/console.py)

Предоставляет локальное управление и просмотр состояния Python-агента.

Основные определения: `main`.

## [agents/windows/device_link.py](../agents/windows/device_link.py)

Обслуживает локальную связь устройства с браузером для Python-варианта агента.

Основные определения: `dpapi`, `validate_link`, `import_enrollment`, `token`, `heartbeat`.

## [agents/windows/endpoint_agent.py](../agents/windows/endpoint_agent.py)

Python-вариант агента: собирает состояние устройства, отправляет heartbeat и события серверу.

Основные определения: `validate_endpoint`, `NoRedirect`, `queue_open`, `enqueue`, `translate`, `collect`, `send_pending`, `unlock`, `main`.

## [agents/windows/local_security.py](../agents/windows/local_security.py)

Хранит вспомогательные операции локальной защиты и работы с секретами Python-агента.

Основные определения: `save_json`, `authenticate`, `new_password`.

## [agents/windows/setup.ps1](../agents/windows/setup.ps1)

Подготавливает окружение и установку Python-варианта Windows-агента.

## [agents/windows/usb_policy.py](../agents/windows/usb_policy.py)

Применяет и восстанавливает локальные ограничения USB-накопителей в Python-варианте агента.

Основные определения: `registry`, `block`, `restore`.

## [agents/windows-native/AegisDLP.cs](../agents/windows-native/AegisDLP.cs)

Исходник Windows-приложения Aegis DLP: служба, сбор состояния, локальное подтверждение браузера, политики, трей и установка.

## [agents/windows-native/build.ps1](../agents/windows-native/build.ps1)

Компилирует AegisDLP.cs в Windows EXE. После изменения комментариев пересборка для работы текущего EXE не нужна.

## [agents/windows-native/collect.ps1](../agents/windows-native/collect.ps1)

Собирает доступные Windows сведения о состоянии устройства для нативного агента.

## [app/__init__.py](../app/__init__.py)

Обозначает Python-пакет для импорта соседних модулей.

## [app/command/__init__.py](../app/command/__init__.py)

Обозначает Python-пакет для импорта соседних модулей.

## [app/command/access.py](../app/command/access.py)

Применяет локальную сетевую политику: доверенные и запрещённые подсети, сведения о подключении и ограничения доступа.

Основные определения: `policy`, `address_in`, `connection`, `evaluate`, `inspect`.

## [app/command/analytics.py](../app/command/analytics.py)

Выполняет дополнительную модельную оценку событий и сохраняет результаты анализа.

Основные определения: `run_model`.

## [app/command/api.py](../app/command/api.py)

Собирает FastAPI-приложение: запуск, вход, события, инциденты, аудит и подключение дополнительных маршрутов.

Основные определения: `lifespan`, `guard`, `conflict`, `health`, `login`, `me`, `auth_options`, `public_demo`, `public_demo_viewer`, `logout`, `get_incident`, `detail`, `dashboard`, `events`, `accept`, `event_detail`, `reanalyze`, `incidents`, `incident`, `update`, `comment`, `investigate`, `link`, `assets`, `rules`, `edit_rule`, `scenarios`, `run`, `create_demo`, `demos`, `scenario_result`, `reset_demo`, `make_report`, `reports`, `download`, `anomalies`, `anomaly_history`, `users`, `add_user`, `toggle_user`, `change_user`, `operators`, `audit_verify`, `audit_list`, `settings`, `save_settings`, `stream`, `legacy_assets_page`, `frontend`.

## [app/command/avatars.py](../app/command/avatars.py)

Обрабатывает изображения профиля и подготовку аватаров для интерфейса.

Основные определения: `generated_avatar`.

## [app/command/connectors.py](../app/command/connectors.py)

Подключает внешние источники событий и обрабатывает настройки интеграций. Реальная работа зависит от заданных подключений.

Основные определения: `NewConnector`, `ConnectorState`, `view`, `providers`, `connectors`, `create`, `target`, `state`, `rotate`, `authenticate`, `check`, `normalize`, `receive`.

## [app/command/curriculum.py](../app/command/curriculum.py)

Хранит учебные материалы и задания для знакомства с разделами и сценариями безопасности.

Основные определения: `section`, `lesson`.

## [app/command/db.py](../app/command/db.py)

Создаёт подключение SQLAlchemy и выдаёт отдельную сессию БД каждому запросу. Локально используется SQLite, на сервере — PostgreSQL.

Основные определения: `Base`, `get_db`.

## [app/command/detection.py](../app/command/detection.py)

Сопоставляет события с правилами, временными окнами и порогами; создаёт предупреждения и связывает доказательства с инцидентами.

Основные определения: `predicate`, `analyze`, `ingest`.

## [app/command/dlp.py](../app/command/dlp.py)

Реализует API Aegis DLP: выдачу установочного ZIP, регистрацию устройств, heartbeat, события, назначения и политики.

Основные определения: `DlpDevice`, `native_build`, `technician`, `device`, `manage`, `view`, `devices`, `candidates`, `Enrollment`, `enroll`, `revoke`, `agent_auth`, `Protection`, `Heartbeat`, `heartbeat`, `events`, `device_events`, `access_status`, `pair_code`, `PairCode`, `pair_agent`, `Assignment`, `assign`, `PolicyInput`, `policy_manager`, `set_policy`, `quick_scan`.

## [app/command/dlp_gate.py](../app/command/dlp_gate.py)

Решает, можно ли открыть рабочие функции: проверяет назначение DLP, связь с браузерным сеансом и свежесть состояния службы.

Основные определения: `key_for_session`, `required`, `access`, `enforce`, `pairing_code`.

## [app/command/governance.py](../app/command/governance.py)

Управляет административными настройками, ролями и организационными ограничениями приложения.

Основные определения: `agent_package`, `manager_lock`, `revoke_sessions`, `deleted`, `delete_user`, `restore_user`, `revoke_user_sessions`, `roles`, `NewRole`, `create_role`, `delete_role`, `overview`.

## [app/command/hosting.py](../app/command/hosting.py)

Нормализует параметры размещения и строку подключения к базе для разных окружений.

Основные определения: `public_origin`, `database_url`.

## [app/command/location.py](../app/command/location.py)

Сопоставляет доступные координаты и локальные справочники с географическими сведениями.

Основные определения: `city_label`.

## [app/command/models.py](../app/command/models.py)

Описывает таблицы основного контура: пользователи, сеансы, события, правила, инциденты и аудит. Изменения схемы оформляются миграциями.

Основные определения: `utcnow`, `Role`, `WorkspaceDocument`, `DocumentVersion`, `DocumentComment`, `User`, `AuthSession`, `SiteVisit`, `UserProfile`, `LoginRecord`, `DemoSession`, `Asset`, `Rule`, `ScenarioRun`, `Event`, `Incident`, `IncidentEvent`, `Alert`, `Comment`, `History`, `Investigation`, `Audit`, `Report`, `ModelVersion`, `Setting`.

## [app/command/news.py](../app/command/news.py)

Получает и подготавливает новости для отображения в приложении.

Основные определения: `parse_feed`, `fetch_feed`, `news`.

## [app/command/presence.py](../app/command/presence.py)

Обрабатывает heartbeat браузеров, присутствие пользователей и сведения об устройствах и подключениях.

Основные определения: `device_name`, `device_brand`, `HeartbeatInput`, `tab_state`, `is_online`, `heartbeat`, `disconnect`, `participants`, `devices`, `EmployeeInput`, `update_employee`.

## [app/command/profile_routes.py](../app/command/profile_routes.py)

Предоставляет HTTP-маршруты для чтения и изменения пользовательских профилей.

Основные определения: `protect_profile`, `GeneratedAvatar`, `avatar_preset`, `avatar_generate`, `profile_row`, `get_profile`, `save_profile`, `avatar_upload`, `avatar_get`, `avatar_delete`, `login_history`, `current_connection`, `share_location`, `get_policy`, `save_policy`, `check_policy`.

## [app/command/profiles.py](../app/command/profiles.py)

Содержит правила работы с профилями, их полями и доступом к персональным сведениям.

Основные определения: `permitted_user`, `sanitize_avatar`, `user_record`.

## [app/command/rbac.py](../app/command/rbac.py)

Определяет базовые и пользовательские роли, полномочия руководителей и доступ к функциям DLP.

Основные определения: `role_info`, `role_base`, `is_admin`, `manages_users`, `dlp_allowed`, `require_target`, `require_assignment`, `operator_role_names`, `permissions`.

## [app/command/recovery.py](../app/command/recovery.py)

Обслуживает восстановление доступа и проверку условий безопасного изменения учётных данных.

Основные определения: `recover_admin`.

## [app/command/reports.py](../app/command/reports.py)

Формирует PDF-отчёты с данными расследования; отвечает за оформление и шрифты документа.

Основные определения: `pdf`.

## [app/command/scenarios.py](../app/command/scenarios.py)

Хранит учебные сценарии и генерирует события для демонстрации детектирования. Это отдельный источник учебных данных.

Основные определения: `catalog`, `generate`.

## [app/command/schemas.py](../app/command/schemas.py)

Проверяет входные JSON-данные через Pydantic до выполнения серверной логики.

Основные определения: `LoginInput`, `UserInput`, `ProfileInput`, `AvatarInput`, `LocationInput`, `NetworkEntry`, `AccessPolicyInput`, `AddressInput`, `UserUpdate`, `EventInput`, `ScenarioInput`, `IncidentUpdate`, `CommentInput`, `InvestigationInput`, `RuleUpdate`.

## [app/command/security.py](../app/command/security.py)

Проверяет пароли и сеансы, выдаёт JWT и записывает связанную HMAC-цепочку аудита.

Основные определения: `secret`, `jwt_key`, `verify`, `audit`, `issue`, `resolve`, `current`, `admin`, `user_manager`, `operator`, `visible`, `owned_demo`.

## [app/command/serialization.py](../app/command/serialization.py)

Преобразует объекты БД в данные ответа API, пригодные для JSON.

Основные определения: `record`.

## [app/command/superapp.py](../app/command/superapp.py)

Добавляет маршруты модулей суперприложения: совместную работу, учебные разделы и связанные записи.

Основные определения: `team_member`, `team`, `team_messages_query`, `message_record`, `team_messages`, `TeamMessageInput`, `send_team_message`, `StrictInput`, `TaskInput`, `TaskUpdate`, `tasks_visible`, `task_record`, `task_history`, `tasks`, `TaskManagementItem`, `TaskManagement`, `manage_tasks`, `create_task`, `change_task`, `save_record`, `history`, `twin`, `m365`, `ImportInput`, `parse_events`, `preview_import`, `import_events`, `MailInput`, `analyze_mail`, `assistant`, `courses`, `Answers`, `grade`, `CustomRule`, `create_rule`, `BuilderEvent`, `ScenarioTemplate`, `scenario`, `run_scenario`.

## [app/command/superapp_models.py](../app/command/superapp_models.py)

Описывает дополнительные таблицы суперприложения: документы, задачи, сообщения и связанные записи.

Основные определения: `WorkTask`, `ModuleRecord`, `TeamMessage`, `Connector`.

## [app/command/workspace.py](../app/command/workspace.py)

Предоставляет операции рабочего пространства расследования и связанных документов.

Основные определения: `validate_content`, `NewDocument`, `SaveDocument`, `Note`, `scope`, `document`, `can_write`, `signature`, `snapshot`, `check_integrity`, `add_version`, `result`, `permitted_incident`, `templates`, `documents`, `DocumentLifecycle`, `document_lifecycle`, `export_document`, `create`, `get_document`, `save`, `versions`, `comment`.

## [app/legacy_main.py](../app/legacy_main.py)

Сохранённый ранний прототип. Текущий запуск через app.main использует Command Center.

Основные определения: `Base`, `User`, `Token`, `Event`, `Incident`, `Audit`, `now`, `password_hash`, `verify_password`, `audit`, `get_db`, `auth`, `operator`, `lifespan`, `home`, `health`, `Login`, `login`, `logout`, `me`, `dashboard`, `events`, `incidents`, `scenarios`, `reset`, `run_scenario`, `StatusUpdate`, `update_incident`, `audit_list`, `audit_verify`.

## [app/main.py](../app/main.py)

Точка входа Uvicorn. Экспортирует приложение из app.command.api; прежний прототип находится в legacy_main.py.

## [app/web/assets/command-center-B6ZIXL0E.js](../app/web/assets/command-center-B6ZIXL0E.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/command-center-CXgqT8rI.js](../app/web/assets/command-center-CXgqT8rI.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/command-center-CXOOmSsi.js](../app/web/assets/command-center-CXOOmSsi.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/command-center-D55pH5_M.js](../app/web/assets/command-center-D55pH5_M.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/command-center-DHGJ_B48.js](../app/web/assets/command-center-DHGJ_B48.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/command-center-NM0K_HqG.js](../app/web/assets/command-center-NM0K_HqG.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/command-center-wmIg5nwq.js](../app/web/assets/command-center-wmIg5nwq.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/command-center-yIY4ponM.js](../app/web/assets/command-center-yIY4ponM.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/emblems-D2NCYc5O.js](../app/web/assets/emblems-D2NCYc5O.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-3YLXZbRN.css](../app/web/assets/index-3YLXZbRN.css)

Стили index-3YLXZbRN: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/index-_Aqvf4IW.css](../app/web/assets/index-_Aqvf4IW.css)

Стили index-_Aqvf4IW: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/index-BA98qlnx.js](../app/web/assets/index-BA98qlnx.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-BA9XJ0uG.css](../app/web/assets/index-BA9XJ0uG.css)

Стили index-BA9XJ0uG: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/index-BbUTMuzT.js](../app/web/assets/index-BbUTMuzT.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-BDmqoW6d.js](../app/web/assets/index-BDmqoW6d.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-BfU4x7ae.css](../app/web/assets/index-BfU4x7ae.css)

Стили index-BfU4x7ae: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/index-Bi1_0eUV.js](../app/web/assets/index-Bi1_0eUV.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-cKexVS7F.css](../app/web/assets/index-cKexVS7F.css)

Стили index-cKexVS7F: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/index-CTapXHdZ.js](../app/web/assets/index-CTapXHdZ.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-DitzcxUB.js](../app/web/assets/index-DitzcxUB.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-DJq6pmpO.css](../app/web/assets/index-DJq6pmpO.css)

Стили index-DJq6pmpO: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/index-DqJTIsNL.css](../app/web/assets/index-DqJTIsNL.css)

Стили index-DqJTIsNL: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/index-Drjgrtsx.css](../app/web/assets/index-Drjgrtsx.css)

Стили index-Drjgrtsx: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/index-DRLREGH-.js](../app/web/assets/index-DRLREGH-.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-DUZpE6Zr.js](../app/web/assets/index-DUZpE6Zr.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-FunON1Ht.js](../app/web/assets/index-FunON1Ht.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-ogIdt4Yz.js](../app/web/assets/index-ogIdt4Yz.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/index-oLWAJxxX.css](../app/web/assets/index-oLWAJxxX.css)

Стили index-oLWAJxxX: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/index-sWYwlrMk.css](../app/web/assets/index-sWYwlrMk.css)

Стили index-sWYwlrMk: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/index-Z4OkTEF8.js](../app/web/assets/index-Z4OkTEF8.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/landing-0rWSzLKO.js](../app/web/assets/landing-0rWSzLKO.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/landing-BSBCv3h-.js](../app/web/assets/landing-BSBCv3h-.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/landing-BuCx4x1a.js](../app/web/assets/landing-BuCx4x1a.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/landing-CL4eGzP1.js](../app/web/assets/landing-CL4eGzP1.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/landing-CM5wVv1P.js](../app/web/assets/landing-CM5wVv1P.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/landing-CMBWS1lk.js](../app/web/assets/landing-CMBWS1lk.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/landing-Dn3qgDRS.js](../app/web/assets/landing-Dn3qgDRS.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/landing-DVa_VujS.js](../app/web/assets/landing-DVa_VujS.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/module-menu-CN0y4v9N.css](../app/web/assets/module-menu-CN0y4v9N.css)

Стили module-menu-CN0y4v9N: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/module-menu-drkW-cGs.js](../app/web/assets/module-menu-drkW-cGs.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/module-menu-DXrXi8LJ.js](../app/web/assets/module-menu-DXrXi8LJ.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/module-menu-Dygin3rq.js](../app/web/assets/module-menu-Dygin3rq.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/module-menu-DyQRVDbq.js](../app/web/assets/module-menu-DyQRVDbq.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/module-menu-GnhXSqzE.js](../app/web/assets/module-menu-GnhXSqzE.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/module-menu-MXLWwFa2.css](../app/web/assets/module-menu-MXLWwFa2.css)

Стили module-menu-MXLWwFa2: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/module-menu-PtANQmeO.js](../app/web/assets/module-menu-PtANQmeO.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/superapp-modules-Bp_syIqb.js](../app/web/assets/superapp-modules-Bp_syIqb.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/superapp-modules-BTAw_8po.js](../app/web/assets/superapp-modules-BTAw_8po.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/superapp-modules-Cbg9UNO_.css](../app/web/assets/superapp-modules-Cbg9UNO_.css)

Стили superapp-modules-Cbg9UNO_: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/superapp-modules-DIAJznpt.js](../app/web/assets/superapp-modules-DIAJznpt.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/superapp-modules-Dmsv0wXO.js](../app/web/assets/superapp-modules-Dmsv0wXO.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/superapp-modules-GksAK607.css](../app/web/assets/superapp-modules-GksAK607.css)

Стили superapp-modules-GksAK607: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/assets/theme-toggle-CzJa5ORs.js](../app/web/assets/theme-toggle-CzJa5ORs.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/workspace-B8_ba3RO.js](../app/web/assets/workspace-B8_ba3RO.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/workspace-Bmyn4q3y.js](../app/web/assets/workspace-Bmyn4q3y.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/workspace-CZcADLHQ.js](../app/web/assets/workspace-CZcADLHQ.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/workspace-DnOfG4K8.js](../app/web/assets/workspace-DnOfG4K8.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/workspace-DowDrJ3s.js](../app/web/assets/workspace-DowDrJ3s.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/workspace-Duyns3WL.js](../app/web/assets/workspace-Duyns3WL.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/workspace-DYOfZ-bn.js](../app/web/assets/workspace-DYOfZ-bn.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/assets/workspace-xXLAuNOE.js](../app/web/assets/workspace-xXLAuNOE.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [app/web/web/assets/index-cKexVS7F.css](../app/web/web/assets/index-cKexVS7F.css)

Стили index-cKexVS7F: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [app/web/web/assets/index-FunON1Ht.js](../app/web/web/assets/index-FunON1Ht.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [frontend/e2e/command.spec.ts](../frontend/e2e/command.spec.ts)

Проверяет подсистему command.spec. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/eslint.config.js](../frontend/eslint.config.js)

Настройка инструментов разработки, сборки или проверки проекта.

## [frontend/playwright.config.ts](../frontend/playwright.config.ts)

Настройка инструментов разработки, сборки или проверки проекта.

## [frontend/scripts/presence-check.mjs](../frontend/scripts/presence-check.mjs)

Проверяет подсистему presence. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/scripts/supper-identity-check.mjs](../frontend/scripts/supper-identity-check.mjs)

Проверяет подсистему supper identity. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/scripts/ultra-intro.mjs](../frontend/scripts/ultra-intro.mjs)

Проверяет подсистему ultra intro. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/scripts/ultra-preview.mjs](../frontend/scripts/ultra-preview.mjs)

Проверяет подсистему ultra preview. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/scripts/ultra-production-check.mjs](../frontend/scripts/ultra-production-check.mjs)

Проверяет подсистему ultra production. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/scripts/ultra-verify.mjs](../frontend/scripts/ultra-verify.mjs)

Проверяет подсистему ultra verify. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/src/api.test.ts](../frontend/src/api.test.ts)

Проверяет подсистему api. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/src/api.ts](../frontend/src/api.ts)

Единая точка HTTP-запросов к /api/v1. Передаёт cookie сеанса, разбирает JSON и сообщает интерфейсу об истечении сеанса и требовании DLP.

Основные определения: `Row`, `ApiError`, `api`.

## [frontend/src/beginner.css](../frontend/src/beginner.css)

Стили beginner: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/command-center.tsx](../frontend/src/command-center.tsx)

Собирает защищённую оболочку, вход, навигацию и рабочие экраны. Учитывает состояние сеанса и требования DLP.

Основные определения: `App`.

## [frontend/src/components/access-policy.tsx](../frontend/src/components/access-policy.tsx)

Даёт администратору интерфейс управления сетевой политикой доступа.

Основные определения: `AccessPolicy`.

## [frontend/src/components/app-tools.tsx](../frontend/src/components/app-tools.tsx)

Объединяет вспомогательные элементы управления рабочими экранами.

Основные определения: `AppTools`, `DevelopmentModules`.

## [frontend/src/components/automatic-location.tsx](../frontend/src/components/automatic-location.tsx)

Запрашивает разрешённые браузером сведения о местоположении и передаёт их в механизм присутствия.

Основные определения: `AutomaticLocation`.

## [frontend/src/components/beginner-help.tsx](../frontend/src/components/beginner-help.tsx)

Показывает подсказки для первого знакомства с интерфейсом.

Основные определения: `PlainLanguageHelp`, `PagePrimer`, `FirstVisit`.

## [frontend/src/components/block-guide.tsx](../frontend/src/components/block-guide.tsx)

Объясняет назначение отдельного блока интерфейса.

Основные определения: `BlockGuide`.

## [frontend/src/components/corporate-integrations.tsx](../frontend/src/components/corporate-integrations.tsx)

Показывает источники событий и состояние корпоративных подключений.

Основные определения: `CorporateIntegrations`.

## [frontend/src/components/defense-story.tsx](../frontend/src/components/defense-story.tsx)

Показывает учебную историю атаки с хакером, оператором и переключением модулей. Сама история не выполняет действия на устройствах.

Основные определения: `DefenseStory`.

## [frontend/src/components/dlp-required.tsx](../frontend/src/components/dlp-required.tsx)

Показывает экран обязательного подключения DLP и кнопку подтверждения локальной службы перед открытием рабочих функций.

Основные определения: `DlpRequired`.

## [frontend/src/components/dlp-workspace.tsx](../frontend/src/components/dlp-workspace.tsx)

Показывает панель Aegis DLP: устройства, установку агента, состояние, назначения и доступные управляющие действия.

Основные определения: `DlpWorkspace`.

## [frontend/src/components/emblems.tsx](../frontend/src/components/emblems.tsx)

Отображает эмблемы с учётом настройки их публичного показа.

Основные определения: `publicEmblemsEnabled`, `Emblem`, `EmblemPair`.

## [frontend/src/components/entry-check.tsx](../frontend/src/components/entry-check.tsx)

Выполняет вступительную проверку и показывает состояние подготовки приложения.

Основные определения: `EntryCheck`.

## [frontend/src/components/event-table.tsx](../frontend/src/components/event-table.tsx)

Показывает события в табличном виде и помогает просматривать их поля.

Основные определения: `EventTable`.

## [frontend/src/components/friendly-event-builder.tsx](../frontend/src/components/friendly-event-builder.tsx)

Собирает входное событие через понятную пользователю форму.

Основные определения: `FriendlyEventBuilder`.

## [frontend/src/components/governance-console.tsx](../frontend/src/components/governance-console.tsx)

Показывает административные формы управления ролями, правами и настройками.

Основные определения: `AccessConsole`.

## [frontend/src/components/investigation-graph.tsx](../frontend/src/components/investigation-graph.tsx)

Отображает связи объектов расследования в виде графа.

Основные определения: `InvestigationGraph`.

## [frontend/src/components/landing.tsx](../frontend/src/components/landing.tsx)

Показывает публичную главную страницу и переходы к рабочему приложению.

Основные определения: `Landing`.

## [frontend/src/components/module-menu.tsx](../frontend/src/components/module-menu.tsx)

Строит меню модулей и переходы между рабочими разделами.

Основные определения: `ModuleMenu`, `ModuleCatalog`.

## [frontend/src/components/presence-workspace.tsx](../frontend/src/components/presence-workspace.tsx)

Показывает участников и устройства; отправляет сигналы присутствия текущего браузерного сеанса.

Основные определения: `PresenceSignal`, `PresenceBadge`, `Participants`, `Devices`, `DemoWelcome`.

## [frontend/src/components/project-experience.tsx](../frontend/src/components/project-experience.tsx)

Показывает презентационный обзор проекта и пользовательских сценариев.

Основные определения: `OverviewShowcase`, `DemonstrationLanding`, `LearningCenter`, `AcademyHub`, `TeamProject`.

## [frontend/src/components/site-assistant.tsx](../frontend/src/components/site-assistant.tsx)

Показывает помощника по сайту и ответы на вопросы о работе разделов.

Основные определения: `SiteAssistant`.

## [frontend/src/components/superapp-modules.tsx](../frontend/src/components/superapp-modules.tsx)

Содержит экраны дополнительных модулей суперприложения.

Основные определения: `SuperappModules`.

## [frontend/src/components/supper-experience.tsx](../frontend/src/components/supper-experience.tsx)

Содержит дополнительные презентационные элементы суперприложения.

Основные определения: `ExperienceSlides`, `CyberNews`, `ServiceWorkflow`, `PersonalExperience`, `ReportsCenter`, `SecurityAnalytics`, `DashboardWelcome`.

## [frontend/src/components/theme-toggle.tsx](../frontend/src/components/theme-toggle.tsx)

Переключает светлую и тёмную темы и сохраняет пользовательский выбор.

Основные определения: `ThemeToggle`.

## [frontend/src/components/training-lab.tsx](../frontend/src/components/training-lab.tsx)

Запускает учебные сценарии и показывает ход практического задания.

Основные определения: `TrainingLab`.

## [frontend/src/components/ui/button.tsx](../frontend/src/components/ui/button.tsx)

Общий компонент кнопки с едиными вариантами оформления.

Основные определения: `Button`.

## [frontend/src/components/ui/dialog.tsx](../frontend/src/components/ui/dialog.tsx)

Общий компонент диалогового окна на основе Radix UI.

Основные определения: `Dialog`.

## [frontend/src/components/ultra-dashboard.tsx](../frontend/src/components/ultra-dashboard.tsx)

Отображает обзор состояния SOC и переходы к разделам, которым требуется внимание.

Основные определения: `UltraDashboard`.

## [frontend/src/components/ultra-incidents.tsx](../frontend/src/components/ultra-incidents.tsx)

Отображает инциденты, их состояние и доступные действия оператора.

Основные определения: `UltraIncidents`.

## [frontend/src/components/ultra-visuals.tsx](../frontend/src/components/ultra-visuals.tsx)

Содержит визуальные элементы панели: индикаторы, диаграммы и пояснения состояния.

Основные определения: `Infrastructure`, `useInfrastructure`, `UltraIntro`, `DigitalCore`, `InfrastructureScene`, `PresentationMode`.

## [frontend/src/components/user-profiles.tsx](../frontend/src/components/user-profiles.tsx)

Показывает профиль пользователя и формы изменения разрешённых персональных данных.

Основные определения: `UserAvatar`, `ProfileEditor`, `LastConnection`, `UsersWorkspace`, `MyConnection`.

## [frontend/src/components/visual-guide.tsx](../frontend/src/components/visual-guide.tsx)

Показывает визуальную инструкцию по разделам приложения.

Основные определения: `VisualGuide`.

## [frontend/src/components/workspace.tsx](../frontend/src/components/workspace.tsx)

Собирает рабочее пространство расследования: документы, записи, совместную работу и редактирование.

Основные определения: `Workspace`.

## [frontend/src/corporate-identity.css](../frontend/src/corporate-identity.css)

Стили corporate-identity: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/corporate-integrations.css](../frontend/src/corporate-integrations.css)

Стили corporate-integrations: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/defense-story.css](../frontend/src/defense-story.css)

Стили defense-story: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/directive.css](../frontend/src/directive.css)

Стили directive: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/dlp.css](../frontend/src/dlp.css)

Стили dlp: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/emblems.css](../frontend/src/emblems.css)

Стили emblems: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/entry-check.css](../frontend/src/entry-check.css)

Стили entry-check: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/governance.css](../frontend/src/governance.css)

Стили governance: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/lib/access.ts](../frontend/src/lib/access.ts)

Содержит клиентские проверки доступности функций по роли. Окончательное разрешение выдаёт сервер.

Основные определения: `RoleInfo`, `useRoleCatalog`.

## [frontend/src/lib/brand.ts](../frontend/src/lib/brand.ts)

Хранит название, слоган и общие текстовые константы бренда.

Основные определения: `BRAND_NAME`, `BRAND_TAGLINE`.

## [frontend/src/lib/defense-story.test.ts](../frontend/src/lib/defense-story.test.ts)

Проверяет подсистему defense story. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/src/lib/defense-story.ts](../frontend/src/lib/defense-story.ts)

Показывает учебную историю атаки с хакером, оператором и переключением модулей. Сама история не выполняет действия на устройствах.

Основные определения: `defensePhases`, `defenseModules`.

## [frontend/src/lib/dlp-proof.ts](../frontend/src/lib/dlp-proof.ts)

Получает одноразовый код у сервера и передаёт его локальной службе на 127.0.0.1:17645 для подтверждения текущего ПК.

Основные определения: `proveLocalDlp`.

## [frontend/src/lib/explainers.ts](../frontend/src/lib/explainers.ts)

Хранит краткие объяснения понятий и функций интерфейса.

Основные определения: `Explainer`, `explainers`, `glossary`, `eventChoices`.

## [frontend/src/lib/learning-examples.test.ts](../frontend/src/lib/learning-examples.test.ts)

Проверяет подсистему learning examples. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/src/lib/learning-examples.ts](../frontend/src/lib/learning-examples.ts)

Хранит примеры для объяснения рабочих ситуаций пользователю.

Основные определения: `learningExamples`.

## [frontend/src/lib/local-guide.test.ts](../frontend/src/lib/local-guide.test.ts)

Проверяет подсистему local guide. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/src/lib/local-guide.ts](../frontend/src/lib/local-guide.ts)

Содержит локальные ответы и справочные сведения для помощника.

Основные определения: `localGuideAnswer`, `siteTour`.

## [frontend/src/lib/modules.ts](../frontend/src/lib/modules.ts)

Описывает каталог модулей, их подписи и назначение.

Основные определения: `modules`, `moduleGroups`, `platformNavigation`.

## [frontend/src/lib/routes.test.ts](../frontend/src/lib/routes.test.ts)

Проверяет подсистему routes. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/src/lib/routes.ts](../frontend/src/lib/routes.ts)

Хранит правила и вспомогательные функции маршрутизации между разделами.

Основные определения: `appPath`, `appPage`, `queryId`, `extendedPages`.

## [frontend/src/lib/training-events.test.ts](../frontend/src/lib/training-events.test.ts)

Проверяет подсистему training events. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/src/lib/training-events.ts](../frontend/src/lib/training-events.ts)

Подготавливает события для учебных заданий.

Основные определения: `TrainingEvent`, `trainingPresets`, `buildTrainingEvents`.

## [frontend/src/lib/utils.test.ts](../frontend/src/lib/utils.test.ts)

Проверяет подсистему utils. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [frontend/src/lib/utils.ts](../frontend/src/lib/utils.ts)

Содержит общие вспомогательные функции интерфейса, включая сборку CSS-классов.

Основные определения: `cn`, `roles`, `statuses`, `nextStatus`, `riskLabel`, `date`.

## [frontend/src/main.tsx](../frontend/src/main.tsx)

Запускает React, подключает общие стили и провайдеры. Корневой адрес открывает главную, остальные пути передаются в CommandCenter.

## [frontend/src/modules.css](../frontend/src/modules.css)

Стили modules: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/motion.css](../frontend/src/motion.css)

Стили motion: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/presence.css](../frontend/src/presence.css)

Стили presence: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/profiles.css](../frontend/src/profiles.css)

Стили profiles: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/project-experience.css](../frontend/src/project-experience.css)

Стили project-experience: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/redesign.css](../frontend/src/redesign.css)

Стили redesign: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/site-assistant.css](../frontend/src/site-assistant.css)

Стили site-assistant: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/style.css](../frontend/src/style.css)

Стили style: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/superapp.css](../frontend/src/superapp.css)

Стили superapp: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/supper-experience.css](../frontend/src/supper-experience.css)

Стили supper-experience: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/ultra.css](../frontend/src/ultra.css)

Стили ultra: задают внешний вид соответствующих классов и адаптацию экрана. Применяются через импорты интерфейса.

## [frontend/src/vite-env.d.ts](../frontend/src/vite-env.d.ts)

Типы и вспомогательные определения клиентской части.

## [frontend/vite.config.ts](../frontend/vite.config.ts)

Настройка инструментов разработки, сборки или проверки проекта.

## [frontend/vitest.config.ts](../frontend/vitest.config.ts)

Настройка инструментов разработки, сборки или проверки проекта.

## [migrations/env.py](../migrations/env.py)

Подключает Alembic к конфигурации SQLAlchemy и запускает миграции схемы базы данных.

## [migrations/versions/001_command_center.py](../migrations/versions/001_command_center.py)

Изменение схемы БД: 001_command_center. Применяется Alembic в порядке связей revision/down_revision.

Основные определения: `upgrade`, `downgrade`.

## [migrations/versions/002_roles.py](../migrations/versions/002_roles.py)

Изменение схемы БД: 002_roles. Применяется Alembic в порядке связей revision/down_revision.

Основные определения: `upgrade`, `downgrade`.

## [migrations/versions/003_profiles_access.py](../migrations/versions/003_profiles_access.py)

Изменение схемы БД: 003_profiles_access. Применяется Alembic в порядке связей revision/down_revision.

Основные определения: `upgrade`, `downgrade`.

## [migrations/versions/004_workspace.py](../migrations/versions/004_workspace.py)

Изменение схемы БД: 004_workspace. Применяется Alembic в порядке связей revision/down_revision.

Основные определения: `upgrade`, `downgrade`.

## [migrations/versions/005_superapp.py](../migrations/versions/005_superapp.py)

Изменение схемы БД: 005_superapp. Применяется Alembic в порядке связей revision/down_revision.

Основные определения: `upgrade`, `downgrade`.

## [migrations/versions/006_team.py](../migrations/versions/006_team.py)

Изменение схемы БД: 006_team. Применяется Alembic в порядке связей revision/down_revision.

Основные определения: `upgrade`, `downgrade`.

## [migrations/versions/007_connectors.py](../migrations/versions/007_connectors.py)

Изменение схемы БД: 007_connectors. Применяется Alembic в порядке связей revision/down_revision.

Основные определения: `upgrade`, `downgrade`.

## [migrations/versions/008_presence.py](../migrations/versions/008_presence.py)

Изменение схемы БД: 008_presence. Применяется Alembic в порядке связей revision/down_revision.

Основные определения: `upgrade`, `downgrade`.

## [migrations/versions/009_roles.py](../migrations/versions/009_roles.py)

Изменение схемы БД: 009_roles. Применяется Alembic в порядке связей revision/down_revision.

Основные определения: `upgrade`, `downgrade`.

## [migrations/versions/010_dlp.py](../migrations/versions/010_dlp.py)

Изменение схемы БД: 010_dlp. Применяется Alembic в порядке связей revision/down_revision.

Основные определения: `upgrade`, `downgrade`.

## [scripts/assign_creator.py](../scripts/assign_creator.py)

Назначает учётной записи роль создателя через административный сценарий.

Основные определения: `assign`.

## [scripts/backup_oracle.py](../scripts/backup_oracle.py)

Создаёт резервную копию серверной базы и проверяет параметры подключения.

Основные определения: `main`.

## [scripts/build_local.ps1](../scripts/build_local.ps1)

Собирает локальную поставку приложения через PowerShell.

## [scripts/create_oracle_env.py](../scripts/create_oracle_env.py)

Готовит конфигурацию окружения для размещения на Oracle.

Основные определения: `main`.

## [scripts/create_public_demo_env.py](../scripts/create_public_demo_env.py)

Готовит окружение для публичной демонстрации.

## [scripts/forward_events.py](../scripts/forward_events.py)

Пересылает события из внешнего источника в API приложения.

Основные определения: `main`.

## [scripts/package_documented_source.py](../scripts/package_documented_source.py)

Собирает архив исходников с пояснениями и SHA-256-манифестом; исключает рабочие .env, базы, зависимости и сборки.

Основные определения: `source_files`, `main`.

## [scripts/package_release.py](../scripts/package_release.py)

Собирает поставку приложения по разрешённому списку файлов и добавляет сведения для проверки комплекта.

Основные определения: `selected_files`, `digest`, `main`.

## [scripts/prepare_render_source.py](../scripts/prepare_render_source.py)

Подготавливает исходники для размещения на Render.

## [scripts/preview_ultra.py](../scripts/preview_ultra.py)

Запускает отдельное локальное окружение для просмотра интерфейса.

## [scripts/public_demo_smoke.js](../scripts/public_demo_smoke.js)

Выполняет базовую браузерную проверку публичной демонстрации.

## [scripts/pull_m365_audit.py](../scripts/pull_m365_audit.py)

Получает аудит Microsoft 365 и передаёт события в приложение при настроенных учётных данных.

Основные определения: `NoRedirect`, `request_json`, `batches`, `main`.

## [scripts/recover_admin.py](../scripts/recover_admin.py)

Восстанавливает административный доступ через служебную команду.

Основные определения: `main`.

## [scripts/set_public_origin.py](../scripts/set_public_origin.py)

Настраивает публичный адрес приложения.

## [scripts/start_local.py](../scripts/start_local.py)

Готовит и запускает локальное приложение на компьютере разработчика.

## [scripts/verify_ultra_image.py](../scripts/verify_ultra_image.py)

Проверяет собранный образ приложения.

Основные определения: `request`.

## [tests/check_postgresql.py](../tests/check_postgresql.py)

Проверяет подсистему check_postgresql. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [tests/check_project.py](../tests/check_project.py)

Проверяет подсистему check_project. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [tests/check_workspace_postgresql.py](../tests/check_workspace_postgresql.py)

Проверяет подсистему check_workspace_postgresql. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

## [tests/conftest.py](../tests/conftest.py)

Проверяет подсистему conftest. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `client`, `admin`.

## [tests/test_command.py](../tests/test_command.py)

Проверяет подсистему command. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `test_every_scenario`, `event`, `test_threshold_window_and_idempotence`, `test_scopes_and_roles`, `test_investigation_report_lifecycle`, `test_validation_and_observer`, `test_anomaly_model`, `test_logout_revokes_jwt`, `test_bad_origin_rejected`, `test_user_password_role_management`, `test_websocket_authenticated`, `test_rule_settings_and_event_link`.

## [tests/test_corporate_integrations.py](../tests/test_corporate_integrations.py)

Проверяет подсистему corporate_integrations. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `create`, `data`, `test_receiver_auth_deduplication_rotation_and_disable`, `test_vendor_normalization`, `test_receiver_atomicity_namespacing_and_limits`, `test_connector_rbac_and_inactive_owner`, `test_city_labels_are_approximate_and_do_not_invent_unknown_city`, `test_public_demo_disabled_by_default_and_scoped`.

## [tests/test_detection_boundaries.py](../tests/test_detection_boundaries.py)

Проверяет подсистему detection_boundaries. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `test_escalation_requires_chronological_chain`, `test_no_false_alarm_under_threshold`, `test_reanalyze_keeps_closed_incident`, `test_feature_types_rejected`, `test_changed_rule_and_rate_limit`.

## [tests/test_dlp_enforcement.py](../tests/test_dlp_enforcement.py)

Проверяет подсистему dlp_enforcement. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `prepare`, `confirm`, `test_mandatory_gate_cannot_be_bypassed_by_direct_api_or_manual_pair`, `test_agent_in_another_login_does_not_unlock_new_session_and_stale_agent_blocks`, `test_policy_signature_and_applied_version_control_access`, `test_roles_optional_until_leadership_assignment`, `test_scan_command_acknowledgement_and_developer_cannot_change_policy`, `test_shared_pc_has_one_agent_but_separate_operator_session_confirmation`.

## [tests/test_dlp_local.py](../tests/test_dlp_local.py)

Проверяет подсистему dlp_local. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `test_password_lockout_persists_and_expires_without_network`, `test_short_or_mismatched_passwords_rejected`, `Registry`, `test_disk_policy_backup_and_exact_restore`, `test_missing_or_invalid_backup_cannot_relax_policy`, `test_offline_init_and_collect_need_no_server_or_login_each_cycle`.

## [tests/test_dlp_panel.py](../tests/test_dlp_panel.py)

Проверяет подсистему dlp_panel. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `visit`, `enroll`, `beat`, `test_dlp_server_side_role_gate`, `test_device_telemetry_events_dedup_and_revocation`, `test_pc_only_and_offline_expired_enrollment`, `test_stale_device_is_offline_and_history_is_bounded`, `test_developer_cannot_revoke_another_owners_agent`, `test_agent_owner_disable_blocks_telemetry_and_cannot_inject_other_types`.

## [tests/test_endpoint_agent.py](../tests/test_endpoint_agent.py)

Проверяет подсистему endpoint_agent. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `sample`, `test_offline_queue_is_persistent_deduplicated_and_contains_no_files`, `Response`, `Opener`, `test_delivery_only_acknowledges_complete_batch_and_preserves_id_ledger`, `test_receiver_rejects_unsafe_transport_or_credential_urls`.

## [tests/test_governance.py](../tests/test_governance.py)

Проверяет подсистему governance. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `login`, `owner`, `create`, `test_creator_assignment_preserves_password_and_operator_features`, `test_cto_cannot_take_over_creator_or_assign_top_roles`, `test_custom_role_permissions_assignment_and_safe_deletion`, `test_delete_restore_and_session_revocation_keep_owned_documents`, `test_deputy_can_manage_lower_roles_but_developer_is_read_only`, `test_role_change_revokes_existing_session_and_unknown_role_rejected`, `test_generated_avatar_and_agent_package`.

## [tests/test_hosting.py](../tests/test_hosting.py)

Проверяет подсистему hosting. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `test_postgresql_hosting_url_uses_installed_driver`, `test_render_origin_and_manual_override`, `test_hosting_rejects_non_origin_values`.

## [tests/test_m365_agent.py](../tests/test_m365_agent.py)

Проверяет подсистему m365_agent. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `prepare`, `test_batches_respect_count_and_size`, `test_sync_updates_checkpoint_only_after_ack`, `test_sync_failure_preserves_checkpoint_and_does_not_forward_key`.

## [tests/test_native_agent.py](../tests/test_native_agent.py)

Проверяет подсистему native_agent. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `test_real_windows_loopback_bridge_cors_and_response_body`, `test_native_crypto_self_test_needs_no_python_installation_or_service`, `test_native_queue_transport_and_signed_policy_rejects_tampering`.

## [tests/test_oracle_setup.py](../tests/test_oracle_setup.py)

Проверяет подсистему oracle_setup. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `script`, `test_oracle_secrets_are_local_hidden_and_never_overwritten`, `test_oracle_hostname_rejects_injection_and_url`.

## [tests/test_presence.py](../tests/test_presence.py)

Проверяет подсистему presence. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `test_devices_persist_and_expire`, `test_guests_visible_but_device_ips_private`, `test_employee_edit_admin_only`.

## [tests/test_profiles_access.py](../tests/test_profiles_access.py)

Проверяет подсистему profiles_access. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `test_profile_avatar_and_metadata`, `test_avatar_validation`, `test_private_profile_permissions`, `test_location_is_opt_in_and_history_persists`, `test_network_rules_and_real_login_blocking`, `test_untrusted_and_trusted_forwarding`, `test_unknown_vpn_is_not_claimed_safe`, `test_unknown_login_recorded`, `test_policy_input_validation_and_lockout_prevention`, `test_existing_session_blocked_but_logout_allowed`.

## [tests/test_recovery.py](../tests/test_recovery.py)

Проверяет подсистему recovery. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `test_recovery_revokes_sessions_and_preserves_identity`, `test_recovery_cannot_promote_non_admin_or_accept_short_password`.

## [tests/test_superapp.py](../tests/test_superapp.py)

Проверяет подсистему superapp. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `event`, `login`, `account`, `test_import_preview_atomic_validation_and_deduplication`, `test_task_transitions_conflicts_and_demo_isolation`, `test_mail_negative_case_and_personal_history`, `test_academy_server_grading_and_observer_permissions`, `test_builder_real_detection_twin_assistant_and_reset`, `test_custom_rule_applies_to_new_events`, `test_m365_imported_monitor_and_bounded_scenario`, `test_import_foreign_duplicate_rolls_back_entire_batch`.

## [tests/test_supper_expansion.py](../tests/test_supper_expansion.py)

Проверяет подсистему supper_expansion. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `test_presence_multiple_tabs_disconnect_and_device_location`, `test_reported_device_names_do_not_invent_hidden_models`, `test_employee_ips_admin_only_and_active_staff_filter`, `test_reviewer_confirms_task_and_history_is_visible`, `test_document_archive_trash_restore_export_and_version_conflict`, `test_guest_cannot_manage_foreign_documents_or_read_task_history`, `test_news_cache_and_stale_data`, `test_news_rejects_external_links_and_entity_definitions`.

## [tests/test_team_learning.py](../tests/test_team_learning.py)

Проверяет подсистему team_learning. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `create_account`, `login`, `message`, `test_shared_chat_deduplication_channels_and_no_private_profile_fields`, `test_demo_chat_isolation_and_read_only_observer`, `test_chat_validation_and_literal_text`, `test_chat_pagination_is_bounded_and_ordered`, `test_expanded_learning_material_and_server_grading`.

## [tests/test_ultra_access.py](../tests/test_ultra_access.py)

Проверяет подсистему ultra_access. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `viewer`, `test_viewer_isolated_scenarios_and_default_deny`, `test_public_viewer_role`, `test_task_archive_restore_and_conflicting_bulk_is_atomic`, `test_incident_task_evidence_cannot_be_deleted`.

## [tests/test_workspace.py](../tests/test_workspace.py)

Проверяет подсистему workspace. Содержит проверки ожидаемого поведения, а не код рабочего сервера.

Основные определения: `new_doc`, `payload`, `test_document_persistence_versions_search_and_comment`, `test_document_conflict_and_approved_protection`, `test_document_rejects_unsafe_content`, `test_table_and_literal_html_are_safe_data`, `test_document_integrity_detects_database_tampering`, `test_version_integrity_detects_database_tampering`, `test_demo_isolation_and_preservation_after_reset`, `test_document_observer_read_only_and_assignee_access`.
