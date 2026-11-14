# Назначение файла: Определяет базовые и пользовательские роли, полномочия руководителей и доступ к функциям DLP.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Role profiles and hierarchy. Stored role names are never rewritten during authentication."""
from fastapi import HTTPException
from sqlalchemy import select

from .models import Role, Setting

# name: label, compatible permission profile, administrative rank
ROLES = {
    "creator": ("Создатель", "admin", 100),
    "cto": ("Chief Technical Director", "admin", 80),
    "admin": ("Администратор", "admin", 70),
    "deputy_cto": ("Заместитель CTO", "analyst", 60),
    "team_lead": ("Руководитель команды", "analyst", 40),
    "analyst": ("Аналитик", "analyst", 30),
    "developer": ("Разработчик", "observer", 20),
    "auditor": ("Аудитор", "observer", 20),
    "observer": ("Наблюдатель", "observer", 10),
    "demo": ("Демонстрационный пользователь", "demo", 0),
    "demo_viewer": ("Демонстрационный просмотр", "demo_viewer", 0),
}


def role_info(name, db=None):
    if name in ROLES:
        label, base, rank = ROLES[name]
    else:
        row = db.get(Role, name) if db else None
        config = db.get(Setting, "rbac:" + name) if db else None
        if not row or not config:
            return {"name": name, "label": name, "base": "observer", "rank": 0}
        base = config.value.get("base", "observer")
        if base not in ("admin", "analyst", "observer"):
            base = "observer"
        label, rank = row.description, {"admin": 65, "analyst": 30, "observer": 10}[base]
    return {"name": name, "label": label, "base": base, "rank": rank}


def role_base(user, db=None):
    return getattr(user, "_access_role", None) or role_info(user.role, db)["base"]


def is_admin(user):
    return role_base(user) == "admin"


def manages_users(user):
    return is_admin(user) or user.role == "deputy_cto"


def dlp_allowed(user, db=None):
    return user.role == "developer" or role_info(user.role, db)["rank"] > 20


def require_target(actor, target, db):
    if actor.id == target.id:
        raise HTTPException(409, "Используйте личный профиль; собственные роль и доступ здесь не меняются")
    if role_info(target.role, db)["rank"] > role_info(actor.role, db)["rank"]:
        raise HTTPException(403, "Нельзя изменять пользователя с вышестоящей ролью")
    if target.role == "creator" and actor.role != "creator":
        raise HTTPException(403, "Доступ создателя изменяет только другой создатель")


def require_assignment(actor, name, db):
    if not db.get(Role, name):
        raise HTTPException(422, "Роль не найдена")
    info = role_info(name, db)
    if info["rank"] > role_info(actor.role, db)["rank"] or (name in ("creator", "cto") and actor.role != "creator"):
        raise HTTPException(403, "Назначение этой роли недоступно")


def operator_role_names(db):
    return [row.name for row in db.scalars(select(Role)) if role_info(row.name, db)["base"] in ("admin", "analyst")]


def permissions(user, db):
    base = role_base(user, db)
    return {
        "dlp": dlp_allowed(user, db),
        "system_admin": base == "admin", "manage_users": base == "admin" or user.role == "deputy_cto",
        "manage_roles": base == "admin", "assign_creator": user.role == "creator",
        "operate": base in ("admin", "analyst", "demo"),
        "approve": base in ("admin", "analyst"),
    }
