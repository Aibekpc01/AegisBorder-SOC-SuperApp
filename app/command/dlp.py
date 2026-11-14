# Назначение файла: Реализует API Aegis DLP: выдачу установочного ZIP, регистрацию устройств, heartbeat, события, назначения и политики.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Device-scoped Aegis DLP enrollment and telemetry. No remote command execution."""
import hashlib
import hmac
import io
import json
import secrets
import zipfile
from datetime import timedelta, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import JSON, ForeignKey, String, select
from sqlalchemy.orm import Mapped, mapped_column

from .access import inspect
from .db import Base, get_db
from .detection import ingest
from .hosting import public_origin
from .models import AuthSession, Setting, SiteVisit, User, utcnow
from .rbac import dlp_allowed, is_admin, require_target, role_info
from .schemas import EventInput
from .security import audit, current


class DlpDevice(Base):
    __tablename__ = "cc_dlp_devices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), index=True)
    data: Mapped[dict] = mapped_column(JSON)


router = APIRouter(prefix="/api/v1/dlp", tags=["Aegis DLP"])
PACKAGE_FILES = ("endpoint_agent.py", "local_security.py", "usb_policy.py", "console.py",
                 "device_link.py", "setup.ps1", "requirements.txt", "README.md")


# Проверяем наличие EXE на сервере, чтобы интерфейс не предлагал несуществующую нативную сборку.
@router.get("/native-build")
def native_build(user=Depends(current)):
    path = Path(__file__).resolve().parents[2] / "agents/windows-native/bin/AegisDLP.exe"
    return {"available": path.is_file(), "version": "2.0.0-native", "python_required": False,
            "signed": False, "sha256": hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None}


def technician(user=Depends(current), db=Depends(get_db)):
    if not dlp_allowed(user, db):
        raise HTTPException(403, "Aegis DLP доступен разработчикам и старшим техническим ролям")
    return user


def device(db, device_id):
    row = db.scalar(select(DlpDevice).where(DlpDevice.id == device_id).with_for_update())
    if not row:
        raise HTTPException(404, "Устройство не найдено")
    return row


def manage(row, user):
    if row.owner_id != user.id and not (is_admin(user) or user.role in ("deputy_cto", "team_lead")):
        raise HTTPException(403, "Изменять подключение может владелец или технический руководитель")


def view(row, user):
    data = row.data
    seen = data.get("last_seen")
    online = bool(seen and utcnow().timestamp() - seen < 100 and not data.get("revoked"))
    return {"id": row.id, "owner_id": row.owner_id,
            **{key: data.get(key) for key in ("name", "created", "last_seen", "hostname", "ip", "snapshot", "revoked", "history", "policy", "commands")},
            "can_policy": is_admin(user) or user.role in ("deputy_cto", "team_lead"),
            "state": "revoked" if data.get("revoked") else "online" if online else "offline" if seen else "pending",
            "can_manage": row.owner_id == user.id or is_admin(user) or user.role in ("deputy_cto", "team_lead")}


@router.get("/devices")
def devices(user=Depends(technician), db=Depends(get_db)):
    return [view(row, user) for row in db.scalars(select(DlpDevice).order_by(DlpDevice.id))]


@router.get("/candidates")
def candidates(user=Depends(technician), db=Depends(get_db)):
    # Browser visits are enrollment targets, never evidence that an agent is installed.
    return [{"id": r.session_id, "name": r.device, "ip": r.ip}
            for r in db.scalars(select(SiteVisit).where(SiteVisit.user_id == user.id))
            if "Windows" in r.device and r.last_seen.replace(tzinfo=timezone.utc) > utcnow() - timedelta(days=7)]


class Enrollment(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    visit_id: str = Field(min_length=1, max_length=64)
    format: Literal["native", "python"] = "native"


# Формируем персональный установочный комплект и данные регистрации. Полученный ZIP относится к конкретному подключению.
@router.post("/enroll", status_code=201)
def enroll(data: Enrollment, request: Request, user=Depends(technician), db=Depends(get_db)):
    visit = db.get(SiteVisit, data.visit_id)
    if not visit or visit.user_id != user.id or "Windows" not in visit.device:
        raise HTTPException(422, "Выберите свой подключённый ПК Windows; телефоны не поддерживаются")
    root = Path(__file__).resolve().parents[2] / "agents" / ("windows-native/bin" if data.format == "native" else "windows")
    files = ("AegisDLP.exe", "README.txt") if data.format == "native" else PACKAGE_FILES
    if not all((root / name).is_file() for name in files):
        raise HTTPException(503, "Пакет Aegis DLP недоступен")
    origin = public_origin() or str(request.base_url).rstrip("/")
    from urllib.parse import urlsplit
    parsed = urlsplit(origin)
    if parsed.scheme != "https" and parsed.hostname not in ("127.0.0.1", "localhost", "testserver"):
        raise HTTPException(503, "Для подключения устройств настройте HTTPS PUBLIC_ORIGIN")
    count = len(list(db.scalars(select(DlpDevice.id).where(DlpDevice.owner_id == user.id))))
    if count >= 100:
        raise HTTPException(409, "Лимит подключений пользователя: 100")
    token, identity = secrets.token_urlsafe(48), str(uuid4())
    row = DlpDevice(id=identity, owner_id=user.id, data={"name": data.name, "created": utcnow().timestamp(),
                    "token_hash": hashlib.sha256(token.encode()).hexdigest(), "revoked": False,
                    "visit_id": visit.session_id, "expires": (utcnow() + timedelta(hours=24)).timestamp(), "history": []})
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in files:
            archive.write(root / name, name)
        from .dlp_gate import pairing_code
        code = pairing_code(db, user, request.state.session.id) if data.format == "native" else None
        archive.writestr("enrollment.json", json.dumps({"device_id": identity, "token": token,
                          "endpoint": origin + f"/api/v1/dlp/agents/{identity}", "name": data.name, "pairing_code": code}))
    db.add(row)
    audit(db, user.id, f"Aegis DLP: создано подключение ПК {identity}")
    db.commit()
    return Response(stream.getvalue(), status_code=201, media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="aegis-dlp-windows.zip"', "Cache-Control": "no-store"})


@router.post("/devices/{device_id}/revoke")
def revoke(device_id: str, user=Depends(technician), db=Depends(get_db)):
    row = device(db, device_id)
    manage(row, user)
    row.data = {**row.data, "revoked": True}
    audit(db, user.id, f"Aegis DLP: отозван ключ ПК {device_id}")
    db.commit()
    return view(row, user)


# Отдельная проверка агента: браузерный вход не заменяет токен устройства.
def agent_auth(db, device_id, request):
    row = device(db, device_id)
    header = request.headers.get("authorization", "")
    token = header[7:] if header.startswith("Bearer ") else ""
    if not token or not hmac.compare_digest(row.data["token_hash"], hashlib.sha256(token.encode()).hexdigest()):
        raise HTTPException(401, "Неверный ключ устройства")
    owner = db.get(User, row.owner_id)
    if row.data.get("revoked") or not owner or not owner.active or not dlp_allowed(owner, db):
        raise HTTPException(403, "Подключение устройства отозвано")
    if not row.data.get("installation_id") and row.data["expires"] < utcnow().timestamp():
        raise HTTPException(403, "Пакет подключения просрочен. Создайте новый")
    if not inspect(db, request)["network"]["allowed"]:
        raise HTTPException(403, "Сеть не разрешена")
    return row


class Protection(BaseModel):
    antivirus: bool | None = None
    realtime: bool | None = None
    service: bool | None = None
    signatures_age: int | None = Field(default=None, ge=0, le=100000)
    usb_read_denied: bool | None = None
    usb_write_denied: bool | None = None
    cpu_percent: float | None = Field(default=None, ge=0, le=100)
    memory_percent: float | None = Field(default=None, ge=0, le=100)


class Heartbeat(BaseModel):
    installation_id: str = Field(min_length=36, max_length=36, pattern=r"^[a-f0-9-]+$")
    hostname: str = Field(min_length=1, max_length=80)
    os: str = Field(min_length=1, max_length=120)
    status: Protection
    collection_error: bool = False
    pending: int = Field(ge=0, le=10000)
    agent_version: str = Field(default="1.0-python", max_length=40)
    service_mode: bool = False
    policy_version: int = Field(default=0, ge=0)
    policy_error: str | None = Field(default=None, max_length=200)
    command_results: dict[str, Literal["started", "completed", "failed"]] = Field(default_factory=dict, max_length=20)


# Принимаем состояние службы и время последней связи; ответ используется агентом для синхронизации управления.
@router.post("/agents/{device_id}/heartbeat")
def heartbeat(device_id: str, data: Heartbeat, request: Request, db=Depends(get_db)):
    row = agent_auth(db, device_id, request)
    if row.data.get("installation_id") not in (None, data.installation_id):
        raise HTTPException(409, "Ключ уже привязан к другому экземпляру агента")
    now = utcnow().timestamp()
    entry = {"time": now, "status": data.status.model_dump(), "collection_error": data.collection_error}
    row.data = {**row.data, "installation_id": data.installation_id, "hostname": data.hostname,
                "ip": inspect(db, request)["ip"], "last_seen": now, "snapshot": data.model_dump(),
                "history": (row.data.get("history", []) + [entry])[-60:]}
    commands = row.data.get("commands", [])
    for command in commands:
        if command["id"] in data.command_results:
            command["status"] = data.command_results[command["id"]]
    row.data = {**row.data, "commands": commands}
    policy = row.data.get("policy", {"version": 1, "usb_mode": "audit"})
    policy_json = json.dumps(policy, sort_keys=True, separators=(",", ":"))
    token = request.headers["authorization"][7:]
    signature = hmac.new(hashlib.sha256((token + ":policy").encode()).digest(), policy_json.encode(), hashlib.sha256).hexdigest()
    db.commit()
    return {"accepted": True, "server_time": now, "policy_json": policy_json, "policy_signature": signature,
            "commands": [c for c in commands if c["status"] == "pending" and now - c.get("created", now) < 1800]}


# Принимаем события только после проверки устройства и передаём их в общий контур обработки событий.
@router.post("/agents/{device_id}/events", status_code=201)
def events(device_id: str, data: list[EventInput], request: Request, db=Depends(get_db)):
    row = agent_auth(db, device_id, request)
    if not row.data.get("installation_id"):
        raise HTTPException(409, "Сначала отправьте heartbeat")
    if not 1 <= len(data) <= 100:
        raise HTTPException(422, "Пакет должен содержать 1–100 событий")
    if any(item.type not in ("endpoint_security_status", "malware_detected") for item in data):
        raise HTTPException(422, "Агент может отправлять только состояние защиты и обнаружения")
    created = duplicates = 0
    ids = list(row.data.get("event_ids", []))
    for item in data:
        payload = item.model_dump()
        # Device cannot impersonate another endpoint or choose a foreign event identity.
        payload.update(external_id="dlp-" + hashlib.sha256((device_id + item.external_id).encode()).hexdigest(),
                       source="Aegis DLP", device=row.data["hostname"])
        event, _, duplicate = ingest(db, payload, row.owner_id)
        if event.id not in ids:
            ids.append(event.id)
        duplicates += int(duplicate)
        created += int(not duplicate)
    row.data = {**row.data, "event_ids": ids[-100:]}
    db.commit()
    return {"created": created, "duplicates": duplicates}


@router.get("/devices/{device_id}/events")
def device_events(device_id: str, user=Depends(technician), db=Depends(get_db)):
    from .models import Event
    row = device(db, device_id)
    # Prefix IDs are cryptographically scoped, device name alone is not a safe selector.
    # Keep bounded event IDs in the endpoint record for exact device filtering.
    ids = row.data.get("event_ids", [])
    return [{"id": e.id, "time": e.time, "type": e.type, "detail": e.detail, "features": e.features}
            for e in db.scalars(select(Event).where(Event.id.in_(ids)).order_by(Event.id.desc()).limit(50))]


@router.get("/access")
def access_status(request: Request, user=Depends(current), db=Depends(get_db)):
    from .dlp_gate import access
    return access(db, user, request.state.session.id)


@router.post("/pair-code")
def pair_code(request: Request, user=Depends(technician), db=Depends(get_db)):
    from .dlp_gate import pairing_code
    code = pairing_code(db, user, request.state.session.id)
    db.commit()
    return {"code": code, "expires_in": 300}


class PairCode(BaseModel):
    code: str = Field(min_length=8, max_length=8, pattern=r"^[A-Fa-f0-9]+$")
    source: Literal["manual", "loopback", "bootstrap"] = "manual"


# Погашаем код привязки и связываем устройство с сеансом браузера, которому этот код был выдан.
@router.post("/agents/{device_id}/pair")
def pair_agent(device_id: str, data: PairCode, request: Request, db=Depends(get_db)):
    from .dlp_gate import key_for_session
    row = agent_auth(db, device_id, request)
    key = "dlp-code:" + hashlib.sha256(data.code.upper().encode()).hexdigest()[:32]
    code = db.scalar(select(Setting).where(Setting.key == key).with_for_update())
    if not code or code.value["expires"] < utcnow().timestamp():
        raise HTTPException(403, "Код недействителен, просрочен или принадлежит другому сотруднику")
    target = db.get(User, code.value["user_id"])
    if not target or not target.active or not dlp_allowed(target, db):
        raise HTTPException(403, "Сотруднику недоступен Aegis DLP")
    if target.id != row.owner_id and data.source != "loopback":
        raise HTTPException(403, "Общий ПК подтверждается только через локальную службу")
    session = db.get(AuthSession, code.value["session_id"])
    if not session or session.user_id != target.id or session.revoked or session.expires.replace(tzinfo=timezone.utc) <= utcnow():
        raise HTTPException(403, "Сеанс сайта завершён")
    identity = key_for_session(session.id)
    link = db.get(Setting, identity)
    value = {"device_id": device_id, "user_id": target.id, "local_confirmed": data.source == "loopback", "local_seen": utcnow().timestamp()}
    if link:
        link.value = value
    else:
        db.add(Setting(key=identity, value=value))
    db.delete(code)
    audit(db, target.id, f"Aegis DLP: подтверждён сеанс сайта устройством {device_id}")
    db.commit()
    return {"paired": True}


class Assignment(BaseModel):
    visit_id: str = Field(min_length=1, max_length=64)


# Назначение хранится отдельно от установки: руководитель определяет, кому обязательно подключить DLP.
@router.post("/assign")
def assign(data: Assignment, actor=Depends(technician), db=Depends(get_db)):
    visit = db.get(SiteVisit, data.visit_id)
    if not visit or "Windows" not in visit.device:
        raise HTTPException(422, "Назначение доступно только для Windows-ПК")
    target = db.get(User, visit.user_id)
    if not target or not target.active or not dlp_allowed(target, db):
        raise HTTPException(422, "Сотрудник должен иметь роль разработчика или выше")
    if role_info(actor.role, db)["rank"] < 40:
        raise HTTPException(403, "Назначать установку может создатель или руководитель")
    if target.id != actor.id:
        require_target(actor, target, db)
    key = f"dlp-required:{target.id}"
    row = db.get(Setting, key)
    value = {"required": True, "assigned_by": actor.id, "visit_id": visit.session_id, "created": utcnow().timestamp()}
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    audit(db, actor.id, f"Aegis DLP: сотруднику #{target.id} назначена обязательная установка")
    db.commit()
    return {"assigned": True}


class PolicyInput(BaseModel):
    usb_mode: Literal["audit", "block", "restore"]


def policy_manager(user):
    if not (is_admin(user) or user.role in ("team_lead", "deputy_cto")):
        raise HTTPException(403, "Политики изменяет технический руководитель")


# Сохраняем желаемую политику; фактическое применение подтверждает агент в следующем состоянии.
@router.post("/devices/{device_id}/policy")
def set_policy(device_id: str, data: PolicyInput, user=Depends(technician), db=Depends(get_db)):
    policy_manager(user)
    row = device(db, device_id)
    if row.data.get("revoked"):
        raise HTTPException(409, "Подключение отозвано")
    version = row.data.get("policy", {"version": 1})["version"] + 1
    row.data = {**row.data, "policy": {"version": version, "usb_mode": data.usb_mode}}
    audit(db, user.id, f"Aegis DLP: политика {version} для {device_id}: {data.usb_mode}")
    db.commit()
    return {"policy": row.data["policy"]}


# Передаём запрос на проверку устройству; выполнение и результат зависят от работающей Windows-службы.
@router.post("/devices/{device_id}/quick-scan")
def quick_scan(device_id: str, user=Depends(technician), db=Depends(get_db)):
    policy_manager(user)
    row = device(db, device_id)
    if row.data.get("revoked"):
        raise HTTPException(409, "Подключение отозвано")
    commands = row.data.get("commands", [])
    if any(c["status"] in ("pending", "started") and utcnow().timestamp() - c.get("created", 0) < 1800 for c in commands):
        raise HTTPException(409, "Проверка уже запрошена или выполняется")
    command = {"id": str(uuid4()), "action": "quick_scan", "status": "pending", "created": utcnow().timestamp()}
    row.data = {**row.data, "commands": (commands + [command])[-10:]}
    audit(db, user.id, f"Aegis DLP: запрошена быстрая проверка {device_id}")
    db.commit()
    return command
