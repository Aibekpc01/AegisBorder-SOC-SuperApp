# Назначение файла: Подключает внешние источники событий и обрабатывает настройки интеграций. Реальная работа зависит от заданных подключений.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Push integration: no vendor credentials, outbound calls or automatic remediation."""

import hashlib
import hmac
import json
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select

from .access import inspect
from .db import get_db
from .detection import ingest
from .models import User, utcnow
from .office365 import is_unified_audit
from .office365 import normalize as office365_normalize
from .rbac import role_base
from .schemas import EventInput
from .security import admin, audit, current
from .superapp_models import Connector

router = APIRouter(prefix="/api/v1/integrations", tags=["Corporate integrations"])
Provider = Literal["kaspersky", "dlp", "m365", "generic"]
PROVIDERS = [
    {
        "id": "kaspersky",
        "name": "Kaspersky",
        "purpose": "Предупреждения антивируса и защита устройств",
        "method": "Экспорт через корпоративный агент → API Aegis",
        "fields": "id, timestamp, host, user, event, detail",
    },
    {
        "id": "dlp",
        "name": "DLP",
        "purpose": "Сигналы о копировании и передаче рабочих данных",
        "method": "Экспорт через корпоративный агент → API Aegis",
        "fields": "event_id, timestamp, workstation, user, action, detail",
    },
    {
        "id": "m365",
        "name": "Microsoft 365 / Office 365",
        "purpose": "Почта Exchange/Outlook, SharePoint, OneDrive, Teams, Entra ID и Purview DLP: письма, архивы, пересылка, внешний доступ",
        "method": "Office 365 Management Activity API → агент scripts/pull_office365_audit.py → API Aegis",
        "fields": "Id, CreationTime, Workload, Operation, UserId (единый журнал аудита) или Graph directoryAudits",
    },
    {
        "id": "generic",
        "name": "Любая система / SIEM",
        "purpose": "Общий формат для корпоративного адаптера",
        "method": "HTTP POST JSON → API Aegis",
        "fields": "external_id, time, device, account, source, type, detail, features",
    },
]


class NewConnector(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}
    name: str = Field(min_length=2, max_length=120)
    provider: Provider


class ConnectorState(BaseModel):
    model_config = {"extra": "forbid"}
    enabled: bool


def view(row):
    return {
        "id": row.id,
        "name": row.name,
        "provider": row.provider,
        "enabled": row.enabled,
        "received": row.received,
        "checked_at": row.checked_at,
        "received_at": row.received_at,
        "created": row.created,
        "endpoint": f"/api/v1/integrations/receivers/{row.id}/events",
        "state": "Отключён"
        if not row.enabled
        else "События поступают"
        if row.received_at
        else "Ключ проверен"
        if row.checked_at
        else "Ожидает настройки отправителя",
    }


@router.get("/providers")
def providers(user=Depends(current)):
    return PROVIDERS


@router.get("/connectors")
def connectors(user=Depends(current), db=Depends(get_db)):
    if user.role in ("demo", "demo_viewer"):
        return []
    return [view(r) for r in db.scalars(select(Connector).order_by(Connector.id.desc()))]


@router.post("/connectors", status_code=201)
def create(data: NewConnector, user=Depends(admin), db=Depends(get_db)):
    token = secrets.token_urlsafe(48)
    row = Connector(
        name=data.name,
        provider=data.provider,
        owner_id=user.id,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
    )
    db.add(row)
    db.flush()
    audit(db, user.id, f"Создан приёмник интеграции {row.id}: {row.provider}")
    db.commit()
    return {**view(row), "token": token}


def target(db, connector_id):
    row = db.scalar(select(Connector).where(Connector.id == connector_id).with_for_update())
    if not row:
        raise HTTPException(404, "Приёмник не найден")
    return row


@router.patch("/connectors/{connector_id}")
def state(connector_id: int, data: ConnectorState, user=Depends(admin), db=Depends(get_db)):
    row = target(db, connector_id)
    row.enabled = data.enabled
    audit(db, user.id, f"Приёмник интеграции {row.id}: enabled={row.enabled}")
    db.commit()
    return view(row)


@router.post("/connectors/{connector_id}/rotate")
def rotate(connector_id: int, user=Depends(admin), db=Depends(get_db)):
    row = target(db, connector_id)
    token = secrets.token_urlsafe(48)
    row.token_hash = hashlib.sha256(token.encode()).hexdigest()
    row.checked_at = None
    audit(db, user.id, f"Заменён ключ приёмника {row.id}")
    db.commit()
    return {**view(row), "token": token}


def authenticate(db, connector_id, request):
    row = target(db, connector_id)
    supplied = request.headers.get("authorization", "")
    key = supplied[7:] if supplied.startswith("Bearer ") else ""
    if not hmac.compare_digest(row.token_hash, hashlib.sha256(key.encode()).hexdigest()):
        raise HTTPException(401, "Неверный ключ приёмника")
    owner = db.get(User, row.owner_id)
    if not row.enabled or not owner or not owner.active or role_base(owner, db) != "admin":
        raise HTTPException(403, "Приёмник отключён или администратор утратил доступ")
    if not inspect(db, request)["network"]["allowed"]:
        raise HTTPException(403, "Сетевая политика запрещает приём")
    return row


@router.post("/receivers/{connector_id}/check")
def check(connector_id: int, request: Request, db=Depends(get_db)):
    row = authenticate(db, connector_id, request)
    row.checked_at = utcnow()
    audit(db, row.owner_id, f"Проверен ключ приёмника {row.id}; события не создавались")
    db.commit()
    return {
        "ok": True,
        "message": "Ключ и API работают. Соединение с продуктом проверяется поступлением событий.",
    }


def normalize(provider, raw, connector_id):
    if not isinstance(raw, dict):
        raise ValueError("Событие должно быть объектом")
    if provider == "generic":
        event = EventInput.model_validate(raw)
    else:
        if provider == "kaspersky":
            data = {
                "external_id": raw.get("id"),
                "time": raw.get("timestamp"),
                "device": raw.get("host"),
                "account": raw.get("user"),
                "type": raw.get("event"),
                "source": "Kaspersky",
            }
        elif provider == "dlp":
            data = {
                "external_id": raw.get("event_id"),
                "time": raw.get("timestamp"),
                "device": raw.get("workstation"),
                "account": raw.get("user"),
                "type": raw.get("action"),
                "source": "DLP",
            }
        elif is_unified_audit(raw):
            # Единый журнал аудита Office 365: почта, SharePoint, OneDrive, Teams, Entra ID, DLP.
            data = office365_normalize(raw)
        else:
            # Accept the documented directory audit export shape, not every Graph resource.
            actor = raw.get("initiatedBy") or {}
            person = actor.get("user") or {}
            application = actor.get("app") or {}
            data = {
                "external_id": raw.get("id"),
                "time": raw.get("activityDateTime"),
                "device": raw.get("device", "Microsoft365"),
                "account": person.get("userPrincipalName")
                or application.get("displayName")
                or application.get("appId"),
                "type": raw.get("type", "office_activity"),
                "source": "Microsoft 365",
            }
        if not is_unified_audit(raw):
            data.update(
                detail=raw.get("detail", raw.get("activityDisplayName", "")),
                features=raw.get("features", {}),
            )
        event = EventInput.model_validate(data)
    # Namespacing keeps two independent corporate systems' IDs separate.
    return event.model_copy(
        update={
            "external_id": f"connector-{connector_id}-"
            + hashlib.sha256(event.external_id.encode()).hexdigest()
        }
    )


@router.post("/receivers/{connector_id}/events", status_code=201)
async def receive(connector_id: int, request: Request, db=Depends(get_db)):
    row = authenticate(db, connector_id, request)
    content = bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content) > 200_000:
            raise HTTPException(413, "Максимум 200 КБ на отправку")
    try:
        payload = json.loads(content)
        records = payload if isinstance(payload, list) else [payload]
        if not 1 <= len(records) <= 200:
            raise ValueError()
        events = [normalize(row.provider, r, row.id) for r in records]
        if len({e.external_id for e in events}) != len(events):
            raise ValueError()
    except (ValueError, TypeError, AttributeError, ValidationError):
        raise HTTPException(
            422,
            "Проверьте формат адаптера, обязательные поля, часовой пояс и уникальность ID. Максимум 200 событий.",
        ) from None
    created = duplicates = 0
    incidents = set()
    for event in events:
        _, ids, duplicate = ingest(db, event, row.owner_id)
        duplicates += int(duplicate)
        created += int(not duplicate)
        incidents.update(ids)
    row.received += created
    row.received_at = utcnow()
    row.checked_at = utcnow()
    audit(
        db,
        row.owner_id,
        f"Приёмник {row.id}: добавлено={created}, повторов={duplicates}, инцидентов={len(incidents)}",
    )
    db.commit()
    return {"created": created, "duplicates": duplicates, "incidents": sorted(incidents)}
