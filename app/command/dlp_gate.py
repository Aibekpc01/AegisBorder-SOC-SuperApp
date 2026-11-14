# Назначение файла: Решает, можно ли открыть рабочие функции: проверяет назначение DLP, связь с браузерным сеансом и свежесть состояния службы.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Server-side endpoint requirement, tied to the authenticated browser session."""
import hashlib
import os
import secrets

from fastapi import HTTPException

from .models import Setting, User, utcnow
from .rbac import dlp_allowed


# В ключе настройки используем хеш идентификатора сеанса, а не исходный идентификатор.
def key_for_session(sid):
    return "dlp-pair:" + hashlib.sha256(sid.encode()).hexdigest()[:32]


# Требование действует только при допустимой роли и явном назначении установки конкретному пользователю.
def required(db, user):
    assignment = db.get(Setting, f"dlp-required:{user.id}")
    return dlp_allowed(user, db) and bool(assignment and assignment.value.get("required"))


# Одного наличия устройства недостаточно: нужны подтверждённый локальный сеанс, свежий heartbeat и применённая политика.
def access(db, user, sid):
    from .dlp import DlpDevice
    enforced = os.getenv("DLP_ENFORCE", "true").lower() == "true"
    needed = required(db, user) and enforced
    pair = db.get(Setting, key_for_session(sid))
    row = db.get(DlpDevice, pair.value.get("device_id")) if pair else None
    data = row.data if row else {}
    owner = db.get(User, row.owner_id) if row else None
    snapshot = data.get("snapshot") or {}
    desired = data.get("policy", {"version": 1})
    verified = bool(row and owner and owner.active and dlp_allowed(owner, db)
                    and pair.value.get("user_id", row.owner_id) == user.id and not data.get("revoked")
                    and pair.value.get("local_confirmed") is True
                    and utcnow().timestamp() - pair.value.get("local_seen", 0) < 100
                    and utcnow().timestamp() - data.get("last_seen", 0) < 100
                    and snapshot.get("agent_version") == "2.0.0-native"
                    and snapshot.get("service_mode") is True
                    and snapshot.get("policy_version", 0) >= desired["version"]
                    and not snapshot.get("policy_error"))
    return {"required": needed, "compliant": not needed or verified, "agent_verified": verified,
            "device_id": row.id if row else None, "assigned": bool(db.get(Setting, f"dlp-required:{user.id}")),
            "reason": "Для работы установите Aegis DLP и подтвердите локальную службу на этом ПК",
            "enforced": enforced}


# Оставляем доступ к входу, установке DLP и присутствию; рабочие API без нужного подтверждения отвечают HTTP 428.
def enforce(db, user, session, path):
    allowed = path.startswith(("/api/v1/dlp/", "/api/v1/auth/")) or path in (
        "/api/v1/health", "/api/v1/presence/devices", "/api/v1/presence/heartbeat",
        "/api/v1/presence/disconnect")
    if not allowed and not access(db, user, session.id)["compliant"]:
        raise HTTPException(428, "Для рабочих функций обязателен Aegis DLP на этом ПК. Откройте раздел DLP и подключите агент")


# Код связывает именно текущий браузерный сеанс с агентом; предыдущие и просроченные коды удаляются.
def pairing_code(db, user, sid):
    code = secrets.token_hex(4).upper()
    key = "dlp-code:" + hashlib.sha256(code.encode()).hexdigest()[:32]
    # Keep only one outstanding code per session and discard expired records.
    from sqlalchemy import select
    for row in db.scalars(select(Setting).where(Setting.key.like("dlp-code:%"))):
        if row.value.get("expires", 0) < utcnow().timestamp() or row.value.get("session_id") == sid:
            db.delete(row)
    db.add(Setting(key=key, value={"user_id": user.id, "session_id": sid, "expires": utcnow().timestamp() + 300}))
    return code
