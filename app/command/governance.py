# Назначение файла: Управляет административными настройками, ролями и организационными ограничениями приложения.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text

from .db import get_db
from .models import Audit, AuthSession, Role, Setting, User, utcnow
from .rbac import ROLES, is_admin, manages_users, require_target, role_info
from .security import admin, audit, current, user_manager

router = APIRouter(prefix="/api/v1", tags=["governance"])


@router.get("/governance/agent-package")
def agent_package(actor=Depends(user_manager)):
    import io
    import zipfile
    from pathlib import Path
    root = Path(__file__).resolve().parents[2] / "agents" / "windows"
    if not root.is_dir():
        raise HTTPException(503, "Пакет прототипа не включён в эту сборку")
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in ("endpoint_agent.py", "local_security.py", "usb_policy.py", "console.py", "device_link.py", "setup.ps1", "requirements.txt", "README.md"):
            archive.write(root / name, name)
    return Response(stream.getvalue(), media_type="application/zip", headers={"Content-Disposition": 'attachment; filename="aegis-dlp-pilot.zip"'})


def manager_lock(db, actor):
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(8142026010)"))
    db.refresh(actor)
    actor._access_role = role_info(actor.role, db)["base"]
    if not actor.active or not manages_users(actor):
        raise HTTPException(403, "Права управления изменились. Войдите повторно")


def revoke_sessions(db, user_id):
    count = 0
    for session in db.scalars(select(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked.is_(False))):
        session.revoked = True
        count += 1
    return count


def deleted(db, user_id):
    return db.get(Setting, f"user-deleted:{user_id}")


@router.delete("/users/{user_id}")
def delete_user(user_id: int, actor=Depends(user_manager), db=Depends(get_db)):
    manager_lock(db, actor)
    row = db.get(User, user_id)
    if not row:
        raise HTTPException(404, "Пользователь не найден")
    require_target(actor, row, db)
    if deleted(db, row.id):
        raise HTTPException(409, "Пользователь уже в корзине")
    db.add(Setting(key=f"user-deleted:{row.id}", value={"deleted_at": utcnow().isoformat(), "actor_id": actor.id, "was_active": row.active}))
    row.active = False
    revoke_sessions(db, row.id)
    audit(db, actor.id, f"Пользователь #{row.id} ({row.username}) перемещён в корзину; сеансы отозваны")
    db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/restore")
def restore_user(user_id: int, actor=Depends(user_manager), db=Depends(get_db)):
    manager_lock(db, actor)
    row = db.get(User, user_id)
    marker = deleted(db, user_id)
    if not row or not marker:
        raise HTTPException(404, "Пользователь в корзине не найден")
    require_target(actor, row, db)
    # Restoration does not reactivate a compromised account automatically.
    row.active = False
    db.delete(marker)
    audit(db, actor.id, f"Пользователь #{row.id} восстановлен без включения доступа")
    db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/revoke-sessions")
def revoke_user_sessions(user_id: int, actor=Depends(user_manager), db=Depends(get_db)):
    manager_lock(db, actor)
    row = db.get(User, user_id)
    if not row:
        raise HTTPException(404, "Пользователь не найден")
    require_target(actor, row, db)
    count = revoke_sessions(db, row.id)
    audit(db, actor.id, f"Отозваны сеансы пользователя #{row.id}: {count}")
    db.commit()
    return {"revoked": count}


@router.get("/roles")
def roles(actor=Depends(current), db=Depends(get_db)):
    result = []
    for role in db.scalars(select(Role).order_by(Role.name)):
        info = role_info(role.name, db)
        count = db.scalar(select(func.count()).select_from(User).where(User.role == role.name))
        assignable = info["rank"] <= role_info(actor.role, db)["rank"] and (role.name not in ("creator", "cto") or actor.role == "creator")
        result.append({**info, "builtin": role.name in ROLES, "assigned": count, "can_assign": assignable})
    return result


class NewRole(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}
    name: str = Field(min_length=3, max_length=30, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(min_length=3, max_length=150)
    base: str = Field(pattern=r"^(observer|analyst|admin)$")


@router.post("/roles", status_code=201)
def create_role(data: NewRole, actor=Depends(admin), db=Depends(get_db)):
    manager_lock(db, actor)
    if not is_admin(actor):
        raise HTTPException(403, "Недостаточно прав")
    if data.name in ROLES or db.get(Role, data.name):
        raise HTTPException(409, "Имя роли уже используется")
    if data.base == "admin" and actor.role != "creator":
        raise HTTPException(403, "Административный профиль новой роли задаёт только создатель")
    db.add(Role(name=data.name, description=data.label))
    db.add(Setting(key="rbac:" + data.name, value={"base": data.base}))
    audit(db, actor.id, f"Создана роль {data.name}, профиль {data.base}")
    db.commit()
    return role_info(data.name, db)


@router.delete("/roles/{name}")
def delete_role(name: str, actor=Depends(admin), db=Depends(get_db)):
    manager_lock(db, actor)
    if not is_admin(actor):
        raise HTTPException(403, "Недостаточно прав")
    if name in ROLES:
        raise HTTPException(409, "Системная роль защищена от удаления")
    row = db.get(Role, name)
    if not row:
        raise HTTPException(404, "Роль не найдена")
    if db.scalar(select(User.id).where(User.role == name).limit(1)):
        raise HTTPException(409, "Сначала переназначьте роль всех пользователей, включая корзину")
    if role_info(name, db)["base"] == "admin" and actor.role != "creator":
        raise HTTPException(403, "Административную роль удаляет только создатель")
    config = db.get(Setting, "rbac:" + name)
    if config:
        db.delete(config)
    db.delete(row)
    audit(db, actor.id, f"Удалена неиспользуемая роль {name}")
    db.commit()
    return {"ok": True}


@router.get("/governance/overview")
def overview(actor=Depends(user_manager), db=Depends(get_db)):
    members = list(db.scalars(select(User)))
    removed = {int(r.key.split(":")[1]) for r in db.scalars(select(Setting).where(Setting.key.startswith("user-deleted:")))}
    staff = [u for u in members if u.id not in removed and u.role not in ("demo", "demo_viewer")]
    sessions = list(db.scalars(select(AuthSession).where(AuthSession.revoked.is_(False))))
    active_ids = {u.id for u in staff if u.active}
    return {"active_staff": len(active_ids), "blocked_staff": sum(not u.active for u in staff),
            "deleted_users": len(removed), "roles": db.scalar(select(func.count()).select_from(Role)),
            "active_sessions": sum(s.user_id in active_ids and s.expires.replace(tzinfo=timezone.utc) > utcnow() for s in sessions),
            "role_counts": {role.name: sum(u.role == role.name for u in staff) for role in db.scalars(select(Role))},
            "history": [{"id": r.id, "time": r.time, "action": r.action, "actor_id": r.actor_id} for r in db.scalars(select(Audit).where(
                Audit.action.ilike("%пользовател%") | Audit.action.ilike("%роль%") | Audit.action.ilike("%сеанс%")
            ).order_by(Audit.id.desc()).limit(20))]}
