"""Local SuperApp modules. No external connections or automatic response actions."""

import csv
import hashlib
import io
import json
import re
from collections import Counter
from datetime import datetime
from typing import Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import select, update

from .curriculum import CORE_CHAPTERS, EXTRA_COURSES
from .db import get_db
from .detection import ingest
from .models import Asset, Event, Incident, IncidentEvent, Rule, Setting, User, UserProfile, utcnow
from .schemas import EventInput
from .security import admin, audit, current, operator, visible
from .serialization import record
from .superapp_models import ModuleRecord, TeamMessage, WorkTask

router = APIRouter(prefix="/api/v1/superapp", tags=["superapp"])


def team_member(db, user):
    profile = db.get(UserProfile, user.id)
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "full_name": profile.full_name if profile else "",
        "department": profile.department if profile else "",
        "position": profile.position if profile else "",
    }


@router.get("/team")
def team(user=Depends(current), db=Depends(get_db)):
    query = select(User).where(User.active.is_(True))
    query = (
        query.where(User.id == user.id) if user.role in ("demo", "demo_viewer") else query.where(User.role.not_in(("demo", "demo_viewer")))
    )
    return {
        "mode": "personal-demo" if user.role in ("demo", "demo_viewer") else "project-team",
        "members": [team_member(db, member) for member in db.scalars(query.order_by(User.id))],
    }


def team_messages_query(user, channel):
    query = select(TeamMessage).where(TeamMessage.channel == channel)
    return (
        query.where(TeamMessage.private.is_(True), TeamMessage.author_id == user.id)
        if user.role in ("demo", "demo_viewer")
        else query.where(TeamMessage.private.is_(False))
    )


def message_record(db, message):
    author = db.get(User, message.author_id)
    return {
        "id": message.id,
        "author_id": message.author_id,
        "channel": message.channel,
        "text": message.text,
        "created": message.created,
        "author": team_member(db, author),
    }


@router.get("/team/messages")
def team_messages(
    channel: Literal["general", "demo", "learning"] = "general",
    before: int | None = Query(default=None, gt=0),
    user=Depends(current),
    db=Depends(get_db),
):
    query = team_messages_query(user, channel)
    if before:
        query = query.where(TeamMessage.id < before)
    rows = list(db.scalars(query.order_by(TeamMessage.id.desc()).limit(101)))
    return {
        "messages": [message_record(db, item) for item in reversed(rows[:100])],
        "has_older": len(rows) > 100,
    }


class TeamMessageInput(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}
    client_id: str = Field(pattern=r"^[a-f0-9-]{36}$")
    channel: Literal["general", "demo", "learning"] = "general"
    text: str = Field(min_length=1, max_length=2000)


@router.post("/team/messages", status_code=201)
def send_team_message(data: TeamMessageInput, user=Depends(operator), db=Depends(get_db)):
    previous = db.scalar(
        select(TeamMessage).where(
            TeamMessage.author_id == user.id, TeamMessage.client_id == data.client_id
        )
    )
    if previous:
        if previous.channel != data.channel or previous.text != data.text:
            raise HTTPException(409, "Идентификатор уже использован для другого сообщения")
        return message_record(db, previous)
    message = TeamMessage(**data.model_dump(), author_id=user.id, private=user.role in ("demo", "demo_viewer"))
    db.add(message)
    db.flush()
    audit(db, user.id, f"Чат: сообщение #{message.id}, канал {message.channel}")
    db.commit()
    return message_record(db, message)


class StrictInput(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}


class TaskInput(StrictInput):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    assignee_id: int | None = Field(default=None, gt=0)
    incident_id: int | None = Field(default=None, gt=0)
    due: datetime | None = None

    @field_validator("due")
    @classmethod
    def due_timezone(cls, value):
        if value and value.tzinfo is None:
            raise ValueError("Укажите часовой пояс срока")
        return value


class TaskUpdate(StrictInput):
    revision: int = Field(ge=1)
    status: Literal["Новая", "В работе", "На проверке", "Завершена"]


def tasks_visible(user):
    query = select(WorkTask)
    if user.role in ("demo", "demo_viewer"):
        return query.where(WorkTask.owner_id == user.id)
    return query.where((WorkTask.private.is_(False)) | (WorkTask.owner_id == user.id))


@router.get("/tasks")
def tasks(state: Literal["active", "archived", "deleted"] = "active", user=Depends(current), db=Depends(get_db)):
    if state != "active" and user.role != "admin":
        raise HTTPException(403, "Архив и корзина доступны администратору")
    result = []
    for task in db.scalars(tasks_visible(user).order_by(WorkTask.id.desc())):
        lifecycle = db.get(Setting, f"task-lifecycle:{task.id}")
        if (lifecycle.value.get("state", "active") if lifecycle else "active") == state:
            result.append({**record(task), "lifecycle": state})
        if len(result) == 200:
            break
    return result


class TaskManagementItem(BaseModel):
    id: int = Field(ge=1)
    revision: int = Field(ge=1)


class TaskManagement(BaseModel):
    action: Literal["edit", "archive", "delete", "restore"]
    items: list[TaskManagementItem] = Field(min_length=1, max_length=100)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)


@router.post("/tasks/manage")
def manage_tasks(data: TaskManagement, user=Depends(admin), db=Depends(get_db)):
    if len({item.id for item in data.items}) != len(data.items):
        raise HTTPException(422, "Повторяющиеся задачи в списке")
    if data.action == "edit" and (len(data.items) != 1 or not data.title or not data.title.strip()):
        raise HTTPException(422, "Укажите название одной редактируемой задачи")
    changed = []
    # Validate the whole selection before applying an atomic bulk action.
    for item in sorted(data.items, key=lambda item: item.id):
        task = db.scalar(select(WorkTask).where(WorkTask.id == item.id).with_for_update())
        if not task:
            raise HTTPException(404, "Задача не найдена")
        if task.revision != item.revision:
            raise HTTPException(409, "Задача изменилась. Обновите список.")
        lifecycle = db.get(Setting, f"task-lifecycle:{task.id}")
        state = lifecycle.value.get("state", "active") if lifecycle else "active"
        if data.action in ("edit", "archive") and state != "active":
            raise HTTPException(409, "Сначала восстановите задачу")
        if data.action == "restore" and state == "active":
            raise HTTPException(409, "Задача уже активна")
        if data.action == "delete" and task.incident_id:
            raise HTTPException(409, "Задачу с материалами инцидента можно только архивировать")
        changed.append((task, lifecycle))
    for task, lifecycle in changed:
        if data.action == "edit":
            task.title = data.title.strip()
            if data.description is not None:
                task.description = data.description
        else:
            value = {"state": {"archive": "archived", "delete": "deleted", "restore": "active"}[data.action]}
            if lifecycle:
                lifecycle.value = value
            else:
                db.add(Setting(key=f"task-lifecycle:{task.id}", value=value))
        task.revision += 1
        task.updated = utcnow()
        audit(db, user.id, f"Управление задачей #{task.id}: {data.action}; версия {task.revision}")
    db.commit()
    return {"updated": [task.id for task, _ in changed]}


@router.post("/tasks", status_code=201)
def create_task(data: TaskInput, user=Depends(operator), db=Depends(get_db)):
    private = user.role in ("demo", "demo_viewer")
    if data.incident_id:
        inc = db.scalar(
            visible(select(Incident).where(Incident.id == data.incident_id), Incident, user)
        )
        if not inc:
            raise HTTPException(404, "Инцидент не найден")
        private = private or inc.demo_id is not None
    if data.assignee_id:
        assignee = db.get(User, data.assignee_id)
        if not assignee or not assignee.active or assignee.role not in ("admin", "analyst", "demo"):
            raise HTTPException(422, "Недопустимый ответственный")
        if private and assignee.id != user.id:
            raise HTTPException(403, "Личная учебная задача назначается только владельцу")
        if not private and assignee.role == "demo":
            raise HTTPException(422, "Общая задача не назначается demo-пользователю")
    task = WorkTask(**data.model_dump(), owner_id=user.id, private=private)
    db.add(task)
    db.flush()
    audit(db, user.id, f"Создана задача SuperApp #{task.id}")
    db.commit()
    return record(task)


@router.patch("/tasks/{task_id}")
def change_task(task_id: int, data: TaskUpdate, user=Depends(operator), db=Depends(get_db)):
    task = db.scalar(tasks_visible(user).where(WorkTask.id == task_id))
    if not task:
        raise HTTPException(404, "Задача не найдена")
    lifecycle = db.get(Setting, f"task-lifecycle:{task.id}")
    if lifecycle and lifecycle.value.get("state") != "active":
        raise HTTPException(409, "Сначала восстановите задачу")
    if user.id not in (task.owner_id, task.assignee_id) and user.role != "admin":
        raise HTTPException(403, "Изменять задачу может владелец или ответственный")
    transitions = {
        "Новая": {"В работе"},
        "В работе": {"Новая", "На проверке"},
        "На проверке": {"В работе", "Завершена"},
        "Завершена": {"В работе"},
    }
    if data.revision != task.revision:
        raise HTTPException(409, "Задача изменилась. Обновите список.")
    if data.status not in transitions[task.status]:
        raise HTTPException(409, "Недопустимый переход статуса")
    if data.status == "Завершена" and user.id != task.owner_id and user.role != "admin":
        raise HTTPException(403, "Завершение подтверждает постановщик задачи")
    changed = db.execute(
        update(WorkTask)
        .where(
            WorkTask.id == task.id,
            WorkTask.revision == data.revision,
        )
        .values(status=data.status, revision=data.revision + 1, updated=utcnow())
    )
    if changed.rowcount != 1:
        raise HTTPException(409, "Задача изменилась. Обновите список.")
    audit(db, user.id, f"Задача #{task.id}: {data.status}")
    db.commit()
    db.refresh(task)
    return record(task)


def save_record(db, user, kind, payload):
    row = ModuleRecord(kind=kind, owner_id=user.id, payload=payload)
    db.add(row)
    db.flush()
    audit(db, user.id, f"SuperApp {kind}: сохранён результат #{row.id}")
    db.commit()
    return record(row)


@router.get("/history/{kind}")
def history(
    kind: Literal["mail", "import", "academy", "scenario"],
    user=Depends(current),
    db=Depends(get_db),
):
    return [
        record(r)
        for r in db.scalars(
            select(ModuleRecord)
            .where(
                ModuleRecord.kind == kind,
                ModuleRecord.owner_id == user.id,
            )
            .order_by(ModuleRecord.id.desc())
            .limit(50)
        )
    ]


@router.get("/twin")
def twin(user=Depends(current), db=Depends(get_db)):
    events = db.scalars(
        visible(select(Event), Event, user).order_by(Event.time.desc()).limit(2000)
    ).all()
    incidents = db.scalars(visible(select(Incident), Incident, user)).all()
    inventory = {a.name: a for a in db.scalars(select(Asset))} if user.role not in ("demo", "demo_viewer") else {}
    names = sorted(set(inventory) | {e.device for e in events})
    nodes = []
    for name in names:
        asset = inventory.get(name)
        related = [
            i
            for i in incidents
            if i.device == name and i.status not in ("Закрыт", "Устранён", "Ложное срабатывание")
        ]
        nodes.append(
            {
                "name": name,
                "kind": asset.kind if asset else "По событиям",
                "status": asset.status if asset else "Нет инвентарной записи",
                "events": sum(e.device == name for e in events),
                "risk": max((i.risk for i in related), default=0),
                "incidents": [i.id for i in related],
            }
        )
    edges = sorted({(e.device, e.account) for e in events})
    return {
        "nodes": nodes,
        "edges": [{"device": d, "account": a} for d, a in edges],
        "event_limit": 2000,
        "mode": "synthetic-demo",
    }


@router.get("/m365")
def m365(user=Depends(current), db=Depends(get_db)):
    events = db.scalars(
        visible(
            select(Event).where(Event.source.in_(["Microsoft 365", "M365", "Microsoft365"])),
            Event,
            user,
        )
        .order_by(Event.time.desc())
        .limit(500)
    ).all()
    return {
        "connected": False,
        "mode": "imported-synthetic",
        "events": [record(e) for e in events],
        "accounts": len({e.account for e in events}),
        "devices": len({e.device for e in events}),
        "types": dict(Counter(e.type for e in events)),
    }


class ImportInput(StrictInput):
    format: Literal["json", "csv"] = "json"
    content: str = Field(min_length=2, max_length=200_000)


def parse_events(data):
    try:
        if data.format == "json":
            rows = json.loads(data.content)
        else:
            rows = list(csv.DictReader(io.StringIO(data.content)))
            for row in rows:
                row["features"] = json.loads(row.get("features") or "{}")
        if not isinstance(rows, list) or not 1 <= len(rows) <= 200:
            raise ValueError("Ожидается от 1 до 200 событий")
        allowed = set(EventInput.model_fields)
        if any(not isinstance(r, dict) or set(r) - allowed for r in rows):
            raise ValueError("Неизвестные поля события")
        events = [EventInput.model_validate(r) for r in rows]
        ids = [e.external_id for e in events]
        if len(ids) != len(set(ids)):
            raise ValueError("Повторяющиеся external_id внутри файла")
        return events
    except (ValueError, TypeError, csv.Error, ValidationError):
        raise HTTPException(
            422,
            "Некорректный JSON/CSV: проверьте поля, часовой пояс и уникальность external_id; максимум 200 событий",
        ) from None


@router.post("/imports/preview")
def preview_import(data: ImportInput, user=Depends(operator)):
    events = parse_events(data)
    return {
        "count": len(events),
        "types": dict(Counter(e.type for e in events)),
        "events": [e.model_dump(mode="json") for e in events[:10]],
    }


@router.post("/imports", status_code=201)
def import_events(data: ImportInput, user=Depends(operator), db=Depends(get_db)):
    if user.role in ("demo", "demo_viewer"):
        raise HTTPException(403, "Импорт общих событий доступен аналитику и администратору")
    events = parse_events(data)
    created = duplicates = 0
    incident_ids = set()
    for event in events:
        _, incidents, duplicate = ingest(db, event, user.id)
        duplicates += int(duplicate)
        created += int(not duplicate)
        incident_ids.update(incidents)
    return save_record(
        db,
        user,
        "import",
        {
            "format": data.format,
            "created": created,
            "duplicates": duplicates,
            "incidents": sorted(incident_ids),
            "sha256": hashlib.sha256(data.content.encode()).hexdigest(),
        },
    )


class MailInput(StrictInput):
    sender: str = Field(min_length=3, max_length=200)
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(max_length=20_000)
    attachments: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("attachments")
    @classmethod
    def attachment_length(cls, values):
        if any(not v or len(v) > 200 for v in values):
            raise ValueError("Недопустимое имя вложения")
        return values


@router.post("/mail/analyze", status_code=201)
def analyze_mail(data: MailInput, user=Depends(operator), db=Depends(get_db)):
    text = (data.subject + " " + data.body).lower()
    findings = []
    urls = re.findall(r"https?://[^\s<>\"']+", data.body, flags=re.I)[:50]
    if any(
        word in text
        for word in ("пароль", "password", "верификац", "подтвердите аккаунт", "введите код")
    ):
        findings.append({"reason": "Запрос учётных данных или кода доступа", "weight": 35})
    if any(word in text for word in ("срочно", "urgent", "заблокирован", "24 часа")):
        findings.append({"reason": "Давление срочностью или блокировкой", "weight": 15})
    if any(
        name.lower().endswith(
            (".exe", ".scr", ".js", ".vbs", ".bat", ".cmd", ".ps1", ".lnk", ".iso", ".html")
        )
        for name in data.attachments
    ):
        findings.append({"reason": "Потенциально исполняемое вложение", "weight": 40})
    for url in urls:
        try:
            parsed = urlsplit(url)
            host = parsed.hostname or ""
            if parsed.username or host.startswith("xn--") or re.fullmatch(r"[\d.]+", host):
                findings.append(
                    {"reason": "Ссылка с IP, Punycode или маскировкой адреса", "weight": 25}
                )
                break
        except ValueError:
            findings.append({"reason": "Некорректный адрес ссылки", "weight": 15})
            break
    score = min(100, sum(f["weight"] for f in findings))
    return save_record(
        db,
        user,
        "mail",
        {
            **data.model_dump(),
            "score": score,
            "findings": findings,
            "urls": urls,
            "verdict": "Требует проверки" if findings else "Заданные признаки не обнаружены",
            "method": "Локальные эвристики; SPF/DKIM/DMARC и содержимое вложений не проверялись",
        },
    )


@router.get("/assistant/{incident_id}")
def assistant(incident_id: int, user=Depends(current), db=Depends(get_db)):
    inc = db.scalar(visible(select(Incident).where(Incident.id == incident_id), Incident, user))
    if not inc:
        raise HTTPException(404, "Инцидент не найден")
    evidence = db.scalars(
        select(Event)
        .join(IncidentEvent, IncidentEvent.event_id == Event.id)
        .where(
            IncidentEvent.incident_id == inc.id,
        )
        .order_by(Event.time)
    ).all()
    return {
        "incident_id": inc.id,
        "method": "Детерминированный черновик по сохранённым доказательствам; языковая модель не подключена",
        "draft": f"Инцидент #{inc.id}: {inc.title}. Устройство: {inc.device}; учётная запись: {inc.account}. Риск по правилам: {inc.risk}/100. Статус: {inc.status}. Связанных событий: {len(evidence)}. Основание: {inc.explanation}",
        "evidence_ids": [e.id for e in evidence],
        "recommendations": inc.recommendations,
        "requires_review": True,
    }


COURSES = [
    {
        "id": "phishing",
        "title": "Подозрительные письма",
        "lesson": "Проверьте отправителя, адрес ссылки и вложения. Срочность и просьба сообщить пароль требуют проверки другим каналом. Не открывайте неизвестное вложение.",
        "questions": [
            {
                "text": "Письмо срочно требует пароль. Что делать?",
                "options": [
                    "Ответить паролем",
                    "Проверить запрос независимым каналом",
                    "Открыть вложение",
                ],
                "answer": 1,
            },
            {
                "text": "Отсутствие признаков в анализаторе означает…",
                "options": [
                    "Письмо гарантированно безопасно",
                    "Нужна собственная проверка",
                    "Можно отключить защиту",
                ],
                "answer": 1,
            },
        ],
    },
    {
        "id": "incident",
        "title": "Расследование инцидента",
        "lesson": "Начните с сохранённых событий и времени. Проверьте объяснение правила, ответственного и контекст. Запишите вывод и отправьте материал на проверку. Учебный риск не доказывает компрометацию.",
        "questions": [
            {
                "text": "На чём основывать заключение?",
                "options": [
                    "На цвете индикатора",
                    "На сохранённых доказательствах и контексте",
                    "На догадке",
                ],
                "answer": 1,
            },
            {
                "text": "Перед закрытием инцидента нужно…",
                "options": [
                    "Удалить события",
                    "Зафиксировать проверку и вывод",
                    "Скрыть уведомление",
                ],
                "answer": 1,
            },
        ],
    },
    {
        "id": "access",
        "title": "Доступ и рабочие материалы",
        "lesson": "Используйте собственную учётную запись. Дождитесь подтверждения сохранения. При конфликте версий сохраните свою копию и обновите документ. Координаты браузера не доказывают физическое присутствие.",
        "questions": [
            {
                "text": "При конфликте версий следует…",
                "options": [
                    "Перезаписать чужую работу",
                    "Сохранить копию и загрузить актуальную версию",
                    "Удалить базу",
                ],
                "answer": 1,
            },
            {
                "text": "Можно ли передавать пароль коллеге?",
                "options": [
                    "Нет, нужна отдельная учётная запись",
                    "Можно для скорости",
                    "Можно в учебном режиме",
                ],
                "answer": 0,
            },
        ],
    },
]


for course in COURSES:
    course.update(
        {
            "category": "Основы безопасности",
            "level": "Для начинающих",
            "duration": "5–7 минут",
            "version": 1,
            "sections": CORE_CHAPTERS[course["id"]],
        }
    )
COURSES += EXTRA_COURSES


@router.get("/academy")
def courses(user=Depends(current)):
    return [
        {**c, "questions": [{"text": q["text"], "options": q["options"]} for q in c["questions"]]}
        for c in COURSES
    ]


class Answers(StrictInput):
    answers: list[int] = Field(min_length=1, max_length=20)


@router.post("/academy/{course_id}", status_code=201)
def grade(course_id: str, data: Answers, user=Depends(current), db=Depends(get_db)):
    course = next((c for c in COURSES if c["id"] == course_id), None)
    if not course:
        raise HTTPException(404, "Курс не найден")
    if len(data.answers) != len(course["questions"]) or any(
        answer < 0 or answer >= len(q["options"])
        for answer, q in zip(data.answers, course["questions"])
    ):
        raise HTTPException(422, "Ответьте на все вопросы")
    correct = [a == q["answer"] for a, q in zip(data.answers, course["questions"])]
    score = round(100 * sum(correct) / len(correct))
    return save_record(
        db,
        user,
        "academy",
        {
            "course_id": course_id,
            "course_version": course.get("version", 1),
            "title": course["title"],
            "score": score,
            "passed": score == 100,
            "correct": correct,
            "answers": data.answers,
            "certificate": "Учебный результат, не профессиональная сертификация",
        },
    )


class CustomRule(StrictInput):
    name: str = Field(min_length=1, max_length=150)
    event_type: str = Field(min_length=1, max_length=60, pattern=r"^[a-z][a-z0-9_]*$")
    threshold: int = Field(ge=1, le=1000)
    window: int = Field(ge=10, le=3600)
    risk: int = Field(ge=1, le=100)
    description: str = Field(min_length=1, max_length=2000)


@router.post("/rules", status_code=201)
def create_rule(data: CustomRule, user=Depends(admin), db=Depends(get_db)):
    import uuid

    row = Rule(id="custom-" + uuid.uuid4().hex[:24], **data.model_dump(), enabled=True)
    db.add(row)
    audit(db, user.id, f"Создано правило {row.id}: подсчёт {data.event_type} в окне")
    db.commit()
    return record(row)


class BuilderEvent(EventInput):
    model_config = {"extra": "forbid"}


class ScenarioTemplate(StrictInput):
    title: str = Field(min_length=1, max_length=150)
    events: list[BuilderEvent] = Field(min_length=1, max_length=100)

    @field_validator("events")
    @classmethod
    def bounded_timeline(cls, events):
        if (max(e.time for e in events) - min(e.time for e in events)).total_seconds() > 86400:
            raise ValueError("Учебная последовательность не должна превышать 24 часа")
        return events


@router.post("/scenarios", status_code=201)
def scenario(data: ScenarioTemplate, user=Depends(operator), db=Depends(get_db)):
    if len(json.dumps(data.model_dump(mode="json"))) > 200_000:
        raise HTTPException(422, "Шаблон слишком большой")
    return save_record(db, user, "scenario", data.model_dump(mode="json"))


@router.post("/scenarios/{scenario_id}/run", status_code=201)
def run_scenario(scenario_id: int, user=Depends(operator), db=Depends(get_db)):
    import uuid

    from .models import DemoSession

    template = db.scalar(
        select(ModuleRecord).where(
            ModuleRecord.id == scenario_id,
            ModuleRecord.kind == "scenario",
            ModuleRecord.owner_id == user.id,
        )
    )
    if not template:
        raise HTTPException(404, "Шаблон не найден")
    data = ScenarioTemplate.model_validate(template.payload)
    demo = DemoSession(owner_id=user.id, title=data.title)
    db.add(demo)
    db.flush()
    start = min(e.time for e in data.events)
    anchor = utcnow()
    incidents = set()
    for item in sorted(data.events, key=lambda e: e.time):
        event = item.model_copy(
            update={
                "external_id": "builder-" + uuid.uuid4().hex,
                "time": anchor + (item.time - start),
            }
        )
        _, created, _ = ingest(db, event, user.id, demo.id)
        incidents.update(created)
    audit(
        db,
        user.id,
        f"Конструктор: шаблон #{template.id}, сеанс #{demo.id}, событий {len(data.events)}",
    )
    db.commit()
    return {"demo_id": demo.id, "events": len(data.events), "incidents": sorted(incidents)}
