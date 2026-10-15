"""Authenticated presence; client IP follows the existing trusted proxy policy."""
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from .access import inspect
from .db import get_db
from .models import AuthSession, SiteVisit, User, UserProfile, utcnow
from .security import current, admin, audit

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
    return device, browser


def is_online(visit, session, active=True):
    now = utcnow()
    return bool(active and visit.connected and not session.revoked
                and session.expires.replace(tzinfo=timezone.utc) > now
                and visit.last_seen.replace(tzinfo=timezone.utc) > now - timedelta(seconds=75))


@router.post("/heartbeat")
def heartbeat(request: Request, user=Depends(current), db=Depends(get_db)):
    sid = request.state.session.id
    row = db.get(SiteVisit, sid)
    info = inspect(db, request)
    if row is None:
        device, browser = device_name(request.headers.get("user-agent", "")[:512])
        row = SiteVisit(session_id=sid, user_id=user.id, device=device, browser=browser,
                        ip=info["ip"])
        db.add(row)
    row.last_seen = utcnow()
    row.ip = info["ip"]
    row.connected = True
    db.commit()
    return {"ok": True, "offline_after_seconds": 75}


@router.get("/participants")
def participants(user=Depends(current), db=Depends(get_db)):
    states = {}
    for visit, session in db.execute(select(SiteVisit, AuthSession).join(AuthSession)):
        state = states.setdefault(visit.user_id, {"online": False, "last_seen": None})
        state["online"] |= is_online(visit, session)
        if state["last_seen"] is None or visit.last_seen > state["last_seen"]:
            state["last_seen"] = visit.last_seen
    members = []
    for member, profile in db.execute(select(User, UserProfile).outerjoin(UserProfile)):
        guest = member.role in ("demo", "demo_viewer")
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
    if user.role != "admin":
        query = query.where(SiteVisit.user_id == user.id)
    rows = []
    for visit, session, owner in db.execute(query.order_by(SiteVisit.last_seen.desc())):
        rows.append({"id": visit.session_id[:12], "user_id": owner.id,
                     "username": f"Гость №{owner.id}" if owner.role in ("demo", "demo_viewer") else owner.username,
                     "device": visit.device, "browser": visit.browser, "ip": visit.ip,
                     "first_seen": visit.first_seen, "last_seen": visit.last_seen,
                     "online": is_online(visit, session, owner.active)})
    return {"devices": rows, "scope": "all" if user.role == "admin" else "own"}


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
