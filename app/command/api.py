# Назначение файла: Собирает FastAPI-приложение: запуск, вход, события, инциденты, аудит и подключение дополнительных маршрутов.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import asyncio
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError

from .analytics import run_model
from .db import SessionLocal, engine, get_db
from .detection import analyze, ingest
from .headers import StaticCompression, security_headers
from .models import (
    Alert,
    Asset,
    Audit,
    AuthSession,
    Comment,
    DemoSession,
    Event,
    History,
    Incident,
    IncidentEvent,
    Investigation,
    LoginRecord,
    ModelVersion,
    Report,
    Role,
    Rule,
    ScenarioRun,
    Setting,
    User,
    UserProfile,
    WorkspaceDocument,
    utcnow,
)
from .office365 import OFFICE365_RULES
from .reports import pdf
from .scenarios import RULES, catalog, generate
from .schemas import (
    CommentInput,
    EventInput,
    IncidentUpdate,
    InvestigationInput,
    LoginInput,
    RuleUpdate,
    ScenarioInput,
    UserInput,
    UserUpdate,
)
from .security import (
    admin,
    audit,
    current,
    hasher,
    issue,
    operator,
    owned_demo,
    resolve,
    secret,
    verify,
    visible,
)

VERSION = "0.3.0"
attempts = defaultdict(deque)
rate_lock = threading.Lock()


from .access import connection as request_connection
from .access import inspect as inspect_connection
from .avatars import generated_avatar
from .connectors import router as connectors_router
from .dlp import router as dlp_router
from .governance import deleted, manager_lock, revoke_sessions
from .governance import router as governance_router
from .hosting import public_origin
from .news import router as news_router
from .presence import router as presence_router
from .profile_routes import router as profile_router
from .profiles import user_record
from .rbac import ROLES, operator_role_names, require_assignment, require_target, role_base
from .security import user_manager
from .serialization import record
from .superapp import router as superapp_router
from .superapp_models import WorkTask
from .workspace import (
    add_version as workspace_version,
)
from .workspace import (
    check_integrity as workspace_integrity,
)
from .workspace import (
    router as workspace_router,
)


@asynccontextmanager
async def lifespan(app):
    # Подготовка приложения выполняется один раз при старте, а не при каждом HTTP-запросе.
    secret()
    with SessionLocal() as db:
        for name, (description, _, _) in ROLES.items():
            if not db.get(Role, name):
                db.add(Role(name=name, description=description))
        db.flush()
        if not db.scalar(select(User).where(User.username == "admin")):
            password = os.getenv("ADMIN_PASSWORD", "")
            if len(password) < 12:
                raise RuntimeError("ADMIN_PASSWORD должен содержать не менее 12 символов")
            user = User(username="admin", password_hash=hasher.hash(password), role="admin")
            db.add(user)
            db.flush()
            audit(db, user.id, "Создан администратор Command Center")
        for sid, name, kind, threshold, window, risk, description in [*RULES, *OFFICE365_RULES]:
            if sid == "complex":
                continue
            if not db.get(Rule, sid):
                db.add(
                    Rule(
                        id=sid,
                        name=name,
                        event_type=kind,
                        threshold=threshold,
                        window=window,
                        risk=risk,
                        description=description,
                    )
                )
        if not db.scalar(select(Asset.id).limit(1)):
            db.add_all(
                [
                    Asset(name="ПК-01", kind="Рабочая станция"),
                    Asset(name="Сервер-01", kind="Сервер", criticality=90),
                    Asset(name="Шлюз-01", kind="Шлюз", criticality=85),
                ]
            )
        db.commit()
    yield


app = FastAPI(title="AegisBorder SuperApp — расследование киберинцидентов и защита информации", version=VERSION, lifespan=lifespan)
app.add_middleware(StaticCompression)
app.include_router(profile_router)
app.include_router(workspace_router)
app.include_router(superapp_router)
app.include_router(connectors_router)
app.include_router(presence_router)
app.include_router(news_router)
app.include_router(governance_router)
app.include_router(dlp_router)


@app.middleware("http")
async def guard(request, call_next):
    # Общая обработка запроса применяется до конкретного маршрута и после получения его ответа.
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.url.path.startswith("/api/") and request.url.path not in (
            "/api/v1/auth/login",
            "/api/v1/auth/logout",
        ):
            stamp = time.monotonic()
            key = ("writes", request_connection(request)["ip"])
            # Each agent has its own quota: many endpoints can share one NAT address.
            if request.url.path.startswith("/api/v1/dlp/agents/"):
                parts = request.url.path.split("/")
                if len(parts) == 7 and len(parts[5]) == 36:
                    key = ("dlp-writes", parts[5])
            with rate_lock:
                queue = attempts[key]
                while queue and queue[0] < stamp - 60:
                    queue.popleft()
                if len(queue) >= 120:
                    return JSONResponse(
                        {"detail": "Лимит операций достигнут. Подождите минуту."}, status_code=429
                    )
                queue.append(stamp)
        origin = request.headers.get("origin")
        allowed = {
            str(request.base_url).rstrip("/"),
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        }
        if public_origin():
            allowed.add(public_origin())
        if origin and origin not in allowed:
            return JSONResponse({"detail": "Источник запроса не разрешён"}, status_code=403)
    response = await call_next(request)
    https = request.url.scheme == "https" or public_origin().startswith("https://")
    response.headers.update(security_headers(request.url.path, https))
    return response


@app.exception_handler(IntegrityError)
async def conflict(request, exc):
    return JSONResponse(
        {"detail": "Запись уже существует или нарушена связь данных"}, status_code=409
    )


@app.get("/api/v1/health")
def health(db=Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "version": VERSION,
        "database": engine.dialect.name,
        "mode": "synthetic-demo",
    }


@app.post("/api/v1/auth/login")
def login(data: LoginInput, request: Request, response: Response, db=Depends(get_db)):
    # Проверка учётной записи и создание сеанса сосредоточены здесь; интерфейс получает результат через API.
    client_ip = request_connection(request)["ip"]
    key = (client_ip, data.username)
    stamp = time.monotonic()
    with rate_lock:
        ip_queue = attempts[("login-ip", client_ip)]
        while ip_queue and ip_queue[0] < stamp - 60:
            ip_queue.popleft()
        if len(ip_queue) >= 30:
            raise HTTPException(429, "Лимит входов с этого адреса достигнут. Подождите минуту.")
        ip_queue.append(stamp)
        queue = attempts[key]
        while queue and queue[0] < stamp - 60:
            queue.popleft()
        if len(queue) >= 10:
            raise HTTPException(429, "Слишком много попыток входа. Подождите минуту.")
        queue.append(stamp)
    user = db.scalar(select(User).where(User.username == data.username))
    info = inspect_connection(db, request)

    def log_attempt(success, reason, session_id=None):
        db.add(
            LoginRecord(
                user_id=user.id if user else None,
                username=data.username,
                session_id=session_id,
                success=success,
                reason=reason[:200],
                user_agent=request.headers.get("user-agent", "")[:512],
                **info,
            )
        )

    if not user or not user.active or not verify(data.password, user.password_hash):
        log_attempt(False, "Неверные реквизиты или учётная запись отключена")
        if user:
            audit(db, user.id, "Неудачная попытка входа")
        db.commit()
        raise HTTPException(401, "Неверное имя пользователя или пароль")
    if not info["network"]["allowed"]:
        log_attempt(False, info["network"]["reason"])
        audit(db, user.id, "Вход запрещён сетевой политикой")
        db.commit()
        raise HTTPException(403, info["network"]["reason"])
    token, session = issue(db, user)
    db.flush()
    log_attempt(True, "Вход разрешён", session.id)
    audit(db, user.id, "Вход в систему")
    db.commit()
    response.set_cookie(
        "aegis_session",
        token,
        httponly=True,
        samesite="strict",
        secure=request.url.scheme == "https" or public_origin().startswith("https://"),
        max_age=7200,
    )
    return user_record(db, user, record)


@app.get("/api/v1/auth/me")
def me(user=Depends(current), db=Depends(get_db)):
    return user_record(db, user, record)


@app.get("/api/v1/auth/options")
def auth_options():
    return {"public_demo": os.getenv("PUBLIC_DEMO_MODE") == "true"}


@app.post("/api/v1/auth/demo")
def public_demo(request: Request, response: Response, db=Depends(get_db), viewer: bool = False):
    if os.getenv("PUBLIC_DEMO_MODE") != "true":
        raise HTTPException(404, "Публичная демонстрация выключена")
    info = inspect_connection(db, request)
    if not info["network"]["allowed"]:
        raise HTTPException(403, info["network"]["reason"])
    stamp = time.monotonic()
    with rate_lock:
        queue = attempts[("public-demo", info["ip"])]
        while queue and queue[0] < stamp - 3600:
            queue.popleft()
        if len(queue) >= 10:
            raise HTTPException(429, "Слишком много новых тренировок с этого IP. Используйте текущую или повторите позже.")
        queue.append(stamp)
    if db.scalar(select(func.count(User.id)).where(User.role.in_(("demo", "demo_viewer")))) >= 1000:
        raise HTTPException(503, "Демонстрационная площадка достигла лимита посетителей")
    user = User(username="guest_" + secrets.token_hex(12), password_hash=hasher.hash(secrets.token_urlsafe(40)), role="demo_viewer" if viewer else "demo")
    db.add(user)
    db.flush()
    token, session = issue(db, user)
    db.flush()
    # A new public workspace starts with isolated, explicitly synthetic examples.
    demo = DemoSession(owner_id=user.id, title="Знакомство: три учебных киберинцидента", progress=3)
    db.add(demo)
    db.flush()
    for scenario_id in ("bruteforce", "restricted", "usb"):
        scenario_run = ScenarioRun(scenario=scenario_id, owner_id=user.id, demo_id=demo.id)
        db.add(scenario_run)
        db.flush()
        for item in generate(scenario_id, scenario_run.id):
            ingest(db, item, user.id, demo.id, scenario_run.id)
    db.add(LoginRecord(user_id=user.id, username=user.username, session_id=session.id, success=True,
                       reason="Личная публичная тренировка", user_agent=request.headers.get("user-agent", "")[:512], **info))
    audit(db, user.id, "Открыта личная публичная тренировка")
    db.commit()
    response.set_cookie("aegis_session", token, httponly=True, samesite="strict",
                        secure=request.url.scheme == "https" or public_origin().startswith("https://"), max_age=7200)
    return user_record(db, user, record)


@app.post("/api/v1/auth/demo-viewer")
def public_demo_viewer(request: Request, response: Response, db=Depends(get_db)):
    return public_demo(request, response, db, viewer=True)


@app.post("/api/v1/auth/logout")
def logout(request: Request, response: Response, user=Depends(current), db=Depends(get_db)):
    request.state.session.revoked = True
    audit(db, user.id, "Выход из системы")
    db.commit()
    response.delete_cookie("aegis_session")
    return {"ok": True}


def get_incident(db, incident_id, user):
    inc = db.scalar(visible(select(Incident).where(Incident.id == incident_id), Incident, user))
    if not inc:
        raise HTTPException(404, "Инцидент не найден")
    return inc


def detail(db, inc):
    result = record(inc)
    result["events"] = [
        record(e)
        for e in db.scalars(
            select(Event)
            .join(IncidentEvent, IncidentEvent.event_id == Event.id)
            .where(IncidentEvent.incident_id == inc.id)
            .order_by(Event.time, Event.id)
        )
    ]
    result["comments"] = [
        record(c)
        for c in db.scalars(
            select(Comment).where(Comment.incident_id == inc.id).order_by(Comment.id)
        )
    ]
    result["history"] = [
        record(h)
        for h in db.scalars(
            select(History).where(History.incident_id == inc.id).order_by(History.id)
        )
    ]
    investigation = db.scalar(select(Investigation).where(Investigation.incident_id == inc.id))
    result["investigation"] = record(investigation) if investigation else None
    result["conclusion"] = investigation.conclusion if investigation else ""
    return result


@app.get("/api/v1/dashboard")
def dashboard(user=Depends(current), db=Depends(get_db)):
    events = list(
        db.scalars(visible(select(Event).order_by(Event.id.desc()).limit(1000), Event, user))
    )
    incidents = list(db.scalars(visible(select(Incident), Incident, user)))
    open_items = [i for i in incidents if i.status not in ("Закрыт", "Ложное срабатывание")]
    buckets = defaultdict(int)
    for event in events:
        buckets[event.time.strftime("%H:%M")] += 1
    return {
        "events": db.scalar(visible(select(func.count()).select_from(Event), Event, user)),
        "incidents": len(incidents),
        "open_incidents": len(open_items),
        "risk": max((i.risk for i in open_items), default=0),
        "assets": len({e.device for e in events}) if user.role in ("demo", "demo_viewer") else db.scalar(select(func.count()).select_from(Asset)),
        "timeline": [{"time": k, "events": v} for k, v in sorted(buckets.items())],
        "distribution": [
            {"name": s, "value": sum(i.status == s for i in incidents)}
            for s in [
                "Новый",
                "На проверке",
                "Подтверждён",
                "Устранён",
                "Закрыт",
                "Ложное срабатывание",
            ]
        ],
    }


@app.get("/api/v1/events")
def events(
    q: str = "",
    type: str = "",
    severity: str = "",
    offset: int = 0,
    limit: int = 100,
    user=Depends(current),
    db=Depends(get_db),
):
    if offset < 0 or not 1 <= limit <= 500:
        raise HTTPException(422, "Недопустимая пагинация")
    query = visible(select(Event), Event, user)
    if q:
        query = query.where(
            Event.detail.icontains(q) | Event.device.icontains(q) | Event.account.icontains(q)
        )
    if type:
        query = query.where(Event.type == type)
    if severity:
        query = query.where(Event.severity == severity)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    return {
        "items": [
            record(e)
            for e in db.scalars(
                query.order_by(Event.time.desc(), Event.id.desc()).offset(offset).limit(limit)
            )
        ],
        "total": total,
    }


@app.post("/api/v1/events")
def accept(data: EventInput, user=Depends(admin), db=Depends(get_db)):
    # Ручной приём использует тот же ingest, что и другие источники событий.
    event, incidents, duplicate = ingest(db, data.model_dump(), user.id)
    if not duplicate:
        audit(db, user.id, f"Принято синтетическое событие {event.id}")
    db.commit()
    return {"event": record(event), "incidents": incidents, "duplicate": duplicate}


@app.get("/api/v1/events/{event_id}")
def event_detail(event_id: int, user=Depends(current), db=Depends(get_db)):
    row = db.scalar(visible(select(Event).where(Event.id == event_id), Event, user))
    if not row:
        raise HTTPException(404, "Событие не найдено")
    return record(row)


@app.post("/api/v1/analytics/reanalyze")
def reanalyze(user=Depends(admin), db=Depends(get_db)):
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(8142026004)"))
    for event in db.scalars(select(Event).order_by(Event.time, Event.id)):
        analyze(db, event)
    audit(db, user.id, "Повторный анализ событий")
    db.commit()
    return {"ok": True}


@app.get("/api/v1/incidents")
def incidents(q: str = "", status: str = "", user=Depends(current), db=Depends(get_db)):
    query = visible(select(Incident), Incident, user)
    if q:
        query = query.where(Incident.title.icontains(q) | Incident.explanation.icontains(q))
    if status:
        query = query.where(Incident.status == status)
    return [record(i) for i in db.scalars(query.order_by(Incident.id.desc()).limit(500))]


@app.get("/api/v1/incidents/{incident_id}")
def incident(incident_id: int, user=Depends(current), db=Depends(get_db)):
    return detail(db, get_incident(db, incident_id, user))


TRANSITIONS = {
    "Новый": ["На проверке", "Ложное срабатывание"],
    "На проверке": ["Подтверждён", "Ложное срабатывание"],
    "Подтверждён": ["Устранён"],
    "Устранён": ["Закрыт"],
    "Закрыт": [],
    "Ложное срабатывание": [],
}


@app.patch("/api/v1/incidents/{incident_id}")
def update(incident_id: int, data: IncidentUpdate, user=Depends(operator), db=Depends(get_db)):
    # Перед изменением инцидента проверяем права; историю действий сохраняем на сервере.
    inc = get_incident(db, incident_id, user)
    actions = []
    if data.status and data.status != inc.status:
        if data.status not in TRANSITIONS[inc.status]:
            raise HTTPException(409, "Недопустимый переход статуса. Следуйте этапам расследования.")
        actions.append(f"Статус: {inc.status} → {data.status}")
        inc.status = data.status
    if "assignee_id" in data.model_fields_set:
        target = db.get(User, data.assignee_id) if data.assignee_id else None
        if data.assignee_id and (
            not target or not target.active or role_base(target, db) not in ("admin", "analyst", "demo")
        ):
            raise HTTPException(422, "Недопустимый ответственный")
        if user.role in ("demo", "demo_viewer") and data.assignee_id not in (None, user.id):
            raise HTTPException(403, "Можно назначить только себя")
        inc.assignee_id = data.assignee_id
        actions.append("Изменён ответственный")
    for action in actions:
        db.add(History(incident_id=inc.id, actor_id=user.id, action=action))
        audit(db, user.id, f"Инцидент {inc.id}: {action}")
    if inc.demo_id and actions:
        db.get(DemoSession, inc.demo_id).progress = max(
            4, db.get(DemoSession, inc.demo_id).progress
        )
    db.commit()
    return detail(db, inc)


@app.post("/api/v1/incidents/{incident_id}/comments")
def comment(incident_id: int, data: CommentInput, user=Depends(operator), db=Depends(get_db)):
    inc = get_incident(db, incident_id, user)
    db.add(Comment(incident_id=inc.id, author_id=user.id, text=data.text))
    audit(db, user.id, f"Комментарий к инциденту {inc.id}")
    db.commit()
    return {"ok": True}


@app.put("/api/v1/incidents/{incident_id}/investigation")
def investigate(
    incident_id: int, data: InvestigationInput, user=Depends(operator), db=Depends(get_db)
):
    inc = get_incident(db, incident_id, user)
    item = db.scalar(select(Investigation).where(Investigation.incident_id == inc.id))
    if not item:
        item = Investigation(incident_id=inc.id)
        db.add(item)
    item.conclusion = data.conclusion
    item.checklist = data.checklist
    item.updated = utcnow()
    if inc.demo_id:
        db.get(DemoSession, inc.demo_id).progress = max(
            5, db.get(DemoSession, inc.demo_id).progress
        )
    audit(db, user.id, f"Расследование инцидента {inc.id} сохранено")
    db.commit()
    return record(item)


@app.post("/api/v1/incidents/{incident_id}/events/{event_id}")
def link(incident_id: int, event_id: int, user=Depends(operator), db=Depends(get_db)):
    inc = get_incident(db, incident_id, user)
    event = db.get(Event, event_id)
    if (
        not event
        or event.demo_id != inc.demo_id
        or (user.role in ("demo", "demo_viewer") and event.owner_id != user.id)
    ):
        raise HTTPException(404, "Связанное событие не найдено")
    if not db.get(IncidentEvent, (inc.id, event.id)):
        db.add(IncidentEvent(incident_id=inc.id, event_id=event.id))
        audit(db, user.id, f"Событие {event.id} связано с инцидентом {inc.id}")
    db.commit()
    return {"ok": True}


@app.get("/api/v1/assets")
def assets(user=Depends(current), db=Depends(get_db)):
    result = []
    for asset in db.scalars(select(Asset).order_by(Asset.id)):
        row = record(asset)
        recent = list(
            db.scalars(
                visible(
                    select(Event)
                    .where(Event.device == asset.name)
                    .order_by(Event.id.desc())
                    .limit(100),
                    Event,
                    user,
                )
            )
        )
        row["event_count"] = db.scalar(
            visible(
                select(func.count()).select_from(Event).where(Event.device == asset.name),
                Event,
                user,
            )
        )
        if recent and recent[0].type == "heartbeat_lost":
            row["status"] = "Нет сигнала (учебное событие)"
        result.append(row)
    return result


@app.get("/api/v1/detection-rules")
def rules(user=Depends(current), db=Depends(get_db)):
    return [record(x) for x in db.scalars(select(Rule).order_by(Rule.id))]


@app.patch("/api/v1/detection-rules/{rule_id}")
def edit_rule(rule_id: str, data: RuleUpdate, user=Depends(admin), db=Depends(get_db)):
    rule = db.get(Rule, rule_id)
    if not rule:
        raise HTTPException(404, "Правило не найдено")
    for key, value in data.model_dump().items():
        setattr(rule, key, value)
    audit(db, user.id, f"Изменены параметры правила {rule_id}")
    db.commit()
    return record(rule)


@app.get("/api/v1/scenarios")
def scenarios(user=Depends(current)):
    return catalog()


@app.post("/api/v1/scenarios/{scenario_id}")
def run(scenario_id: str, data: ScenarioInput, user=Depends(operator), db=Depends(get_db)):
    if scenario_id not in {x[0] for x in RULES}:
        raise HTTPException(404, "Сценарий не найден")
    demo = owned_demo(db, data.demo_id, user) if data.demo_id else None
    if user.role in ("demo", "demo_viewer") and not demo:
        raise HTTPException(422, "Сначала создайте собственный учебный сеанс")
    run = ScenarioRun(scenario=scenario_id, owner_id=user.id, demo_id=data.demo_id)
    db.add(run)
    db.flush()
    ids = []
    for item in generate(scenario_id, run.id):
        event, _, _ = ingest(db, item, user.id, data.demo_id, run.id)
        ids.append(event.id)
    incidents = list(
        db.scalars(
            select(IncidentEvent.incident_id).where(IncidentEvent.event_id.in_(ids)).distinct()
        )
    )
    if demo:
        demo.progress = max(demo.progress, 3)
    audit(db, user.id, f"Запуск сценария {scenario_id}; событий: {len(ids)}")
    db.commit()
    return {
        "run_id": run.id,
        "events": ids,
        "incidents": incidents,
        "steps": [
            "События нормализованы",
            "События сохранены",
            "Правила корреляции применены",
            "Риск рассчитан по доказательствам",
        ],
    }


@app.post("/api/v1/demo-sessions")
def create_demo(user=Depends(operator), db=Depends(get_db)):
    item = DemoSession(owner_id=user.id)
    db.add(item)
    db.flush()
    audit(db, user.id, f"Создан учебный сеанс {item.id}")
    db.commit()
    return record(item)


@app.get("/api/v1/demo-sessions")
def demos(user=Depends(current), db=Depends(get_db)):
    return [
        record(x)
        for x in db.scalars(
            select(DemoSession)
            .where(DemoSession.owner_id == user.id)
            .order_by(DemoSession.id.desc())
        )
    ]


@app.get("/api/v1/scenario-runs/{run_id}")
def scenario_result(run_id: int, user=Depends(current), db=Depends(get_db)):
    run = db.get(ScenarioRun, run_id)
    if not run or run.owner_id != user.id:
        raise HTTPException(404, "Результат тренировки не найден")
    events = list(
        db.scalars(select(Event).where(Event.run_id == run_id).order_by(Event.time, Event.id))
    )
    ids = list(
        db.scalars(
            select(IncidentEvent.incident_id)
            .where(IncidentEvent.event_id.in_([e.id for e in events]))
            .distinct()
        )
    )
    return {
        "run": record(run),
        "events": [record(e) for e in events],
        "incidents": [record(db.get(Incident, i)) for i in ids],
    }


@app.post("/api/v1/demo-sessions/{demo_id}/reset")
def reset_demo(demo_id: int, user=Depends(operator), db=Depends(get_db)):
    session = owned_demo(db, demo_id, user)
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(8142026004)"))
    inc_ids = list(
        db.scalars(
            select(Incident.id).where(Incident.demo_id == demo_id, Incident.owner_id == user.id)
        )
    )
    for model in (Alert, Comment, History, Investigation, Report, IncidentEvent):
        db.execute(delete(model).where(model.incident_id.in_(inc_ids)))
    for doc in db.scalars(
        select(WorkspaceDocument).where(WorkspaceDocument.incident_id.in_(inc_ids))
    ):
        workspace_integrity(db, doc)
        doc.incident_id = None
        doc.revision += 1
        doc.updated = utcnow()
        workspace_version(db, doc, user)
        audit(
            db,
            user.id,
            f"Workspace: документ {doc.id} сохранён после сброса учебного сеанса, связь снята",
        )
    for task in db.scalars(select(WorkTask).where(WorkTask.incident_id.in_(inc_ids)).with_for_update()):
        task.incident_id = None
        task.revision += 1
        task.updated = utcnow()
        audit(db, user.id, f"Задача #{task.id}: снята связь после сброса учебного сеанса")
    db.flush()
    db.execute(delete(Incident).where(Incident.id.in_(inc_ids)))
    db.execute(delete(Event).where(Event.demo_id == demo_id, Event.owner_id == user.id))
    db.execute(
        delete(ScenarioRun).where(ScenarioRun.demo_id == demo_id, ScenarioRun.owner_id == user.id)
    )
    session.progress = 0
    audit(db, user.id, f"Сброшены собственные данные учебного сеанса {demo_id}")
    db.commit()
    return {"ok": True}


@app.post("/api/v1/reports/{incident_id}")
def make_report(incident_id: int, user=Depends(operator), db=Depends(get_db)):
    # Отчёт строится по сохранённому инциденту и его доказательствам, а не по состоянию открытой страницы.
    inc = get_incident(db, incident_id, user)
    snapshot = detail(db, inc)
    pdf(snapshot)
    row = Report(incident_id=inc.id, owner_id=user.id, snapshot=snapshot)
    db.add(row)
    db.flush()
    if inc.demo_id:
        db.get(DemoSession, inc.demo_id).progress = 6
    audit(db, user.id, f"Сформирован PDF-отчёт {row.id}")
    db.commit()
    return record(row)


@app.get("/api/v1/reports")
def reports(user=Depends(current), db=Depends(get_db)):
    query = select(Report).join(Incident, Report.incident_id == Incident.id)
    query = visible(query, Incident, user)
    return [record(r) for r in db.scalars(query.order_by(Report.id.desc()))]


@app.get("/api/v1/reports/{report_id}/pdf")
def download(report_id: int, user=Depends(current), db=Depends(get_db)):
    row = db.get(Report, report_id)
    if not row:
        raise HTTPException(404, "Отчёт не найден")
    get_incident(db, row.incident_id, user)
    return Response(
        pdf(row.snapshot),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="aegis-report-{row.id}.pdf"'},
    )


@app.post("/api/v1/analytics/anomalies")
def anomalies(user=Depends(operator), db=Depends(get_db)):
    items = list(
        db.scalars(visible(select(Event).order_by(Event.id.desc()).limit(1000), Event, user))
    )
    model = run_model(db, items, user.id)
    audit(db, user.id, f"Анализ аномалий: модель {model.id}")
    db.commit()
    return record(model)


@app.get("/api/v1/analytics/anomalies")
def anomaly_history(user=Depends(current), db=Depends(get_db)):
    return [
        record(m)
        for m in db.scalars(
            select(ModelVersion)
            .where(ModelVersion.owner_id == user.id)
            .order_by(ModelVersion.id.desc())
            .limit(20)
        )
    ]


@app.get("/api/v1/users")
def users(state: str = "active", user=Depends(user_manager), db=Depends(get_db)):
    if state not in ("active", "deleted"):
        raise HTTPException(422, "Недопустимый список пользователей")
    return [user_record(db, u, record) for u in db.scalars(select(User).order_by(User.id))
            if bool(deleted(db, u.id)) == (state == "deleted")]


@app.post("/api/v1/users")
def add_user(data: UserInput, user=Depends(user_manager), db=Depends(get_db)):
    manager_lock(db, user)
    require_assignment(user, data.role, db)
    row = User(username=data.username, password_hash=hasher.hash(data.password), role=data.role)
    db.add(row)
    db.flush()
    db.add(
        UserProfile(
            user_id=row.id,
            full_name=data.full_name,
            department=data.department,
            position=data.position,
            avatar_data=generated_avatar(row.id, 0),
        )
    )
    audit(db, user.id, f"Создан пользователь {row.username}, роль {row.role}")
    db.commit()
    return user_record(db, row, record)


@app.patch("/api/v1/users/{user_id}/active")
def toggle_user(user_id: int, user=Depends(user_manager), db=Depends(get_db)):
    manager_lock(db, user)
    row = db.get(User, user_id)
    if not row:
        raise HTTPException(404, "Пользователь не найден")
    if row.id == user.id:
        raise HTTPException(409, "Нельзя отключить собственную учётную запись")
    require_target(user, row, db)
    if deleted(db, row.id):
        raise HTTPException(409, "Сначала восстановите пользователя из корзины")
    revoke_sessions(db, row.id)
    row.active = not row.active
    audit(db, user.id, f"Изменена активность {row.username}: {row.active}")
    db.commit()
    return record(row)


@app.patch("/api/v1/users/{user_id}")
def change_user(user_id: int, data: UserUpdate, user=Depends(user_manager), db=Depends(get_db)):
    manager_lock(db, user)
    row = db.get(User, user_id)
    if not row:
        raise HTTPException(404, "Пользователь не найден")
    if row.id != user.id:
        require_target(user, row, db)
    if data.role and row.id == user.id and data.role != row.role:
        raise HTTPException(409, "Нельзя менять собственную роль")
    if deleted(db, row.id):
        raise HTTPException(409, "Сначала восстановите пользователя из корзины")
    if data.role:
        if row.role != data.role:
            require_assignment(user, data.role, db)
            revoke_sessions(db, row.id)
        row.role = data.role
        audit(db, user.id, f"Изменена роль {row.username}: {row.role}")
    if data.password:
        row.password_hash = hasher.hash(data.password)
        for session in db.scalars(select(AuthSession).where(AuthSession.user_id == row.id)):
            session.revoked = True
        audit(db, user.id, f"Изменён пароль пользователя {row.username}; сеансы отозваны")
    db.commit()
    return record(row)


@app.get("/api/v1/operators")
def operators(user=Depends(current), db=Depends(get_db)):
    if user.role in ("demo", "demo_viewer"):
        return [{"id": user.id, "username": user.username}]
    return [
        {"id": x.id, "username": x.username}
        for x in db.scalars(
            select(User).where(User.active.is_(True), User.role.in_(operator_role_names(db)))
        )
    ]


@app.get("/api/v1/audit/verify")
def audit_verify(user=Depends(current), db=Depends(get_db)):
    # Заново вычисляем подписи по порядку: изменение старой записи нарушает связь с последующими.
    previous = "0" * 64
    count = 0
    for row in db.scalars(select(Audit).order_by(Audit.id)):
        payload = json.dumps(
            [row.time, row.actor_id, row.action, previous],
            ensure_ascii=False,
            separators=(",", ":"),
        )
        expected = hmac.new(secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
        if row.prev_hash != previous or not hmac.compare_digest(expected, row.record_hash):
            return {"valid": False, "broken_id": row.id}
        previous = row.record_hash
        count += 1
    return {"valid": True, "records": count}


@app.get("/api/v1/audit")
def audit_list(user=Depends(current), db=Depends(get_db)):
    query = select(Audit)
    if user.role in ("demo", "demo_viewer"):
        query = query.where(Audit.actor_id == user.id)
    return [record(x) for x in db.scalars(query.order_by(Audit.id.desc()).limit(200))]


@app.get("/api/v1/settings")
def settings(user=Depends(current), db=Depends(get_db)):
    row = db.get(Setting, "system")
    return row.value if row else {"organization": "AegisBorder SuperApp", "simple_mode": True}


@app.put("/api/v1/settings")
def save_settings(data: dict, user=Depends(admin), db=Depends(get_db)):
    organization = data.get("organization", "")
    if not isinstance(organization, str) or not 1 <= len(organization) <= 150:
        raise HTTPException(422, "Название должно содержать 1–150 символов")
    value = {"organization": organization, "simple_mode": bool(data.get("simple_mode", True))}
    row = db.get(Setting, "system")
    if not row:
        row = Setting(key="system", value=value)
        db.add(row)
    else:
        row.value = value
    audit(db, user.id, "Изменены настройки учебной системы")
    db.commit()
    return value


@app.websocket("/api/v1/ws")
async def stream(websocket: WebSocket):
    # Отдельный канал обновлений; доступ к нему также требует проверки серверного сеанса.
    origin = websocket.headers.get("origin")
    allowed = {
        f"http://{websocket.headers.get('host')}",
        f"https://{websocket.headers.get('host')}",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    }
    if origin and origin not in allowed:
        await websocket.close(code=1008)
        return
    token = websocket.cookies.get("aegis_session", "")
    try:
        with SessionLocal() as db:
            stream_user, stream_session = resolve(db, token)
            from .dlp_gate import access as dlp_access
            if not dlp_access(db, stream_user, stream_session.id)["compliant"]:
                await websocket.close(code=1008)
                return
            if not inspect_connection(db, websocket)["network"]["allowed"]:
                await websocket.close(code=1008)
                return
    except HTTPException:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        while True:
            with SessionLocal() as db:
                user, session = resolve(db, token)
                if not dlp_access(db, user, session.id)["compliant"]:
                    await websocket.close(code=1008)
                    return
                if not inspect_connection(db, websocket)["network"]["allowed"]:
                    await websocket.close(code=1008)
                    return
                last = db.scalar(visible(select(func.max(Event.id)), Event, user)) or 0
                count = db.scalar(
                    visible(select(func.count()).select_from(Incident), Incident, user)
                )
            await websocket.send_json({"event_revision": last, "incidents": count})
            await asyncio.sleep(2)
    except (WebSocketDisconnect, HTTPException, RuntimeError):
        pass


dist = Path(__file__).resolve().parents[1] / "web"


@app.get("/assets", include_in_schema=False)
@app.get("/assets/", include_in_schema=False)
def legacy_assets_page():
    # Старый раздел компьютеров не должен перехватываться каталогом JS/CSS.
    return frontend("assets")


if (dist / "assets").exists():
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    # Для клиентского маршрута отдаём точку входа React, чтобы прямые ссылки открывались после обновления страницы.
    if path.startswith("api/"):
        raise HTTPException(404, "Маршрут API не найден")
    if (dist / "index.html").exists():
        return FileResponse(dist / "index.html")
    return JSONResponse({"detail": "Соберите frontend: npm run build"}, status_code=503)
