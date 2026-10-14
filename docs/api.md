# API v1

Модуль документов: `/api/v1/workspace/templates`, `/workspace/documents`, `/workspace/documents/{id}`, `/workspace/documents/{id}/versions`, `/workspace/documents/{id}/comments`. Поля, права и обработка конфликтов описаны в [инструкции Workspace](workspace.md).

OpenAPI: http://127.0.0.1:8000/docs. Браузер использует HttpOnly-cookie после POST /api/v1/auth/login; для тестов можно передать этот JWT в Authorization: Bearer. Токен не возвращается в JSON и не хранится в sessionStorage.

| Маршруты | Возможности |
|---|---|
| GET /health | Проверка подключения и версия |
| POST /auth/login, /auth/logout; GET /auth/me | Сеанс |
| GET /dashboard | Счётчики и диаграммы |
| GET /events?q=&severity=&type=&offset=&limit= | Поиск, фильтрация, пагинация |
| POST /events | Приём синтетического события администратором |
| GET /incidents, /incidents/{id} | Список и доказательства |
| PATCH /incidents/{id} | Статус, ответственный |
| POST /incidents/{id}/comments | Комментарий |
| PUT /incidents/{id}/investigation | Чек-лист и вывод |
| POST /incidents/{id}/events/{event_id} | Связь дополнительного события |
| GET /assets | Учебный инвентарь |
| GET /detection-rules; PATCH /detection-rules/{id} | Параметры правил |
| POST /analytics/reanalyze | Повторная корреляция |
| GET, POST /analytics/anomalies | История и запуск Isolation Forest |
| GET /scenarios; POST /scenarios/{id} | 15 ситуаций; тело {demo_id: number или null} |
| GET /scenario-runs/{id} | Сохранённые события и инциденты своего запуска для интерактивного полигона |
| GET, POST /demo-sessions | Собственные учебные сеансы |
| POST /demo-sessions/{id}/reset | Сброс своего сеанса |
| GET /reports; POST /reports/{incident_id} | Снимок отчёта |
| GET /reports/{id}/pdf | Скачать PDF |
| GET, POST /users; PATCH /users/{id}/active | Администрирование |
| PATCH /users/{id}; GET /operators | Изменение роли/пароля; список ответственных |
| GET, PUT /users/{id}/profile | Личные данные: владелец или администратор |
| GET, PUT, DELETE /users/{id}/avatar | Фото в PNG; JSON image_data_url при загрузке |
| GET /users/{id}/logins | Приватная история входов |
| GET /auth/connection; POST /auth/location | Текущий адрес; добровольные координаты браузера |
| GET, PUT /access-policy; POST /access-policy/check | Сетевая политика и проверка IP, только администратор |
| GET /events/{id} | Подробности доступного события |
| GET /audit, /audit/verify | Действия и целостность |
| GET, PUT /settings | Настройки |
| WS /ws | Ревизии сохранённых данных, cookie-аутентификация |

Все адреса таблицы начинаются с /api/v1. Ответы 401 — вход, 403 — права/источник запроса, 404 — отсутствующий либо чужой объект, 409 — конфликт, 422 — входные данные, 429 — лимит входа.
