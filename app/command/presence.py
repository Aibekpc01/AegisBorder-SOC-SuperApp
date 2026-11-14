# Назначение файла: Обрабатывает heartbeat браузеров, присутствие пользователей и сведения об устройствах и подключениях.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Authenticated presence; client IP follows the existing trusted proxy policy."""
import hashlib
import re
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from .access import evaluate, inspect, policy
from .db import get_db
from .models import AuthSession, LoginRecord, Setting, SiteVisit, User, UserProfile, utcnow
from .rbac import is_admin, require_target
from .security import admin, audit, current

router = APIRouter(prefix="/api/v1/presence", tags=["presence"])


def device_name(ua):
    device = next((name for token, name in (
        ("iPhone", "iPhone"), ("iPad", "iPad"), ("Android", "Android"),
        ("Windows", "Компьютер Windows"), ("Macintosh", "Mac"),
        ("Linux", "Компьютер Linux")) if token in ua), "Неизвестное устройство")
    browser = next((name for token, name in (
        ("Edg", "Edge"), ("YaBrowser", "Яндекс Браузер"), ("OPR", "Opera"),
        ("Firefox", "Firefox"), ("FxiOS", "Firefox"), ("Chrome", "Chrome"),
        ("CriOS", "Chrome"), ("Safari", "Safari")) if token in ua), "Браузер")
    model = re.search(r"Android[^;]*;\s*(?:[a-z]{2}[-_][A-Z]{2};\s*)?([^;)]+)", ua)
    if model:
        value = model[1].split(" Build/")[0].strip()
        if value not in ("K", "wv"):
            device = value[:100]
    return device, browser


def device_brand(name):
    patterns = (
        (r"iPhone|iPad|Mac", "Apple"), (r"Samsung|SM-", "Samsung"),
        (r"Pixel", "Google"), (r"Xiaomi|Redmi|POCO", "Xiaomi"),
        (r"Huawei", "Huawei"), (r"Honor", "Honor"), (r"OnePlus", "OnePlus"),
    )
    return next((brand for pattern, brand in patterns if re.search(pattern, name, re.I)), "")


class HeartbeatInput(BaseModel):
    tab_id: str = Field(default="legacy", min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    model: str = Field(default="", max_length=80)


def tab_state(db, sid, tab_id, connected):
    key = "presence-tabs:" + hashlib.sha256(sid.encode()).hexdigest()[:32]
    row = db.get(Setting, key)
    now = utcnow().timestamp()
    values = {k: v for k, v in (row.value if row else {}).items() if v > now - 75}
    if connected:
        values[tab_id] = now
    else:
        values.pop(tab_id, None)
    if row:
        row.value = values
    else:
        db.add(Setting(key=key, value=values))
    return bool(values)


def is_online(visit, session, active=True):
    now = utcnow()
    return bool(active and visit.connected and not session.revoked
                and session.expires.replace(tzinfo=timezone.utc) > now
                and visit.last_seen.replace(tzinfo=timezone.utc) > now - timedelta(seconds=75))


@router.post("/heartbeat")
def heartbeat(request: Request, data: HeartbeatInput = HeartbeatInput(), user=Depends(current), db=Depends(get_db)):
    sid = request.state.session.id
    db.scalar(select(AuthSession).where(AuthSession.id == sid).with_for_update())
    row = db.scalar(select(SiteVisit).where(SiteVisit.session_id == sid).with_for_update())
    info = inspect(db, request)
    if row is None:
        device, browser = device_name(request.headers.get("user-agent", "")[:512])
        row = SiteVisit(session_id=sid, user_id=user.id, device=device, browser=browser,
                        ip=info["ip"])
        db.add(row)
    if data.model.strip():
        row.device = data.model.strip()[:100]
    row.last_seen = utcnow()
    row.ip = info["ip"]
    row.connected = tab_state(db, sid, data.tab_id, True)
    db.commit()
    return {"ok": True, "offline_after_seconds": 75}


@router.post("/disconnect")
def disconnect(request: Request, data: HeartbeatInput, user=Depends(current), db=Depends(get_db)):
    sid = request.state.session.id
    db.scalar(select(AuthSession).where(AuthSession.id == sid).with_for_update())
    row = db.scalar(select(SiteVisit).where(SiteVisit.session_id == sid).with_for_update())
    if row:
        row.connected = tab_state(db, sid, data.tab_id, False)
        db.commit()
    return {"ok": True}


@router.get("/participants")
def participants(staff: bool = False, user=Depends(current), db=Depends(get_db)):
    states = {}
    for visit, session in db.execute(select(SiteVisit, AuthSession).join(AuthSession)):
        state = states.setdefault(visit.user_id, {"online": False, "last_seen": None})
        state["online"] |= is_online(visit, session)
        if state["last_seen"] is None or visit.last_seen > state["last_seen"]:
            state["last_seen"] = visit.last_seen
            if is_admin(user):
                state["ip"] = visit.ip
    members = []
    for member, profile in db.execute(select(User, UserProfile).outerjoin(UserProfile)):
        guest = member.role in ("demo", "demo_viewer")
        if staff and (guest or not member.active):
            continue
        state = states.get(member.id, {"online": False, "last_seen": None})
        members.append({
            "id": member.id, "username": f"Гость №{member.id}" if guest else member.username,
            "full_name": profile.full_name if profile and not guest else "",
            "department": profile.department if profile and not guest else "",
            "position": profile.position if profile and not guest else "",
            "role": member.role, "active": member.active, "guest": guest,
            **state, "online": state["online"] and member.active,
        })
    members.sort(key=lambda row: (not row["online"], row["guest"], row["id"]))
    return {"members": members, "offline_after_seconds": 75}


@router.get("/devices")
def devices(user=Depends(current), db=Depends(get_db)):
    query = (select(SiteVisit, AuthSession, User).select_from(SiteVisit)
             .join(AuthSession, AuthSession.id == SiteVisit.session_id)
             .join(User, User.id == SiteVisit.user_id))
    # Public guests can explore their own connection, never other visitors' IPs.
    if not is_admin(user):
        query = query.where(SiteVisit.user_id == user.id)
    rows = []
    config = policy(db)
    logins = {r.session_id: r for r in db.scalars(select(LoginRecord).where(LoginRecord.success.is_(True)).order_by(LoginRecord.id))}
    for visit, session, owner in db.execute(query.order_by(SiteVisit.last_seen.desc())):
        login = logins.get(visit.session_id)
        location = login.location if login and login.location else {}
        browser_city = bool(location.get("city"))
        network = evaluate(visit.ip, config)
        from .dlp_gate import required
        from .rbac import dlp_allowed, role_info
        can_assign = owner.active and dlp_allowed(owner, db) and "Windows" in visit.device and (
            role_info(user.role, db)["rank"] >= max(40, role_info(owner.role, db)["rank"]))
        rows.append({"id": visit.session_id[:12], "user_id": owner.id,
                     "dlp_visit_id": visit.session_id, "dlp_required": required(db, owner), "dlp_can_assign": can_assign,
                     "dlp_assigned": bool(db.get(Setting, f"dlp-required:{owner.id}")),
                     "username": f"Гость №{owner.id}" if owner.role in ("demo", "demo_viewer") else owner.username,
                     "device": visit.device, "browser": visit.browser, "ip": visit.ip,
                     "brand": device_brand(visit.device),
                     "city": location.get("city") or network["city"],
                     "city_source": location.get("city_source") if browser_city else network["location_source"],
                     "accuracy": location.get("accuracy") if browser_city else None,
                     "location_observed_at": location.get("observed_at") if browser_city else None,
                     "device_source": "Сообщено браузером; точная модель может быть скрыта",
                     "first_seen": visit.first_seen, "last_seen": visit.last_seen,
                     "online": is_online(visit, session, owner.active)})
    return {"devices": rows, "scope": "all" if is_admin(user) else "own"}


class EmployeeInput(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}
    full_name: str = Field(max_length=160)
    department: str = Field(max_length=120)
    position: str = Field(max_length=120)


@router.patch("/employees/{user_id}")
def update_employee(user_id: int, data: EmployeeInput, actor=Depends(admin), db=Depends(get_db)):
    member = db.get(User, user_id)
    if not member or member.role in ("demo", "demo_viewer"):
        raise HTTPException(404, "Сотрудник не найден")
    # The employee shortcut must enforce the same hierarchy as the profile API.
    if member.id != actor.id:
        require_target(actor, member, db)
    profile = db.get(UserProfile, user_id)
    if profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
    for key, value in data.model_dump().items():
        setattr(profile, key, value)
    profile.updated = utcnow()
    audit(db, actor.id, f"Обновлена карточка сотрудника #{user_id}")
    db.commit()
    return {"ok": True}
