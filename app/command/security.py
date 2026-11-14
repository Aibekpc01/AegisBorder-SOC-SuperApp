# Назначение файла: Проверяет пароли и сеансы, выдаёт JWT и записывает связанную HMAC-цепочку аудита.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import hashlib
import hmac
import json
import os
import secrets
from datetime import timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select, text

from .db import get_db
from .models import Audit, AuthSession, User, utcnow
from .rbac import is_admin, manages_users, role_base, role_info

hasher = PasswordHasher()


# Единый секрет берём из окружения; короткий ключ отклоняем до подписи токенов и аудита.
def secret():
    key = os.getenv("AUDIT_KEY", "")
    if len(key) < 32:
        raise RuntimeError("AUDIT_KEY должен содержать не менее 32 символов")
    return key


def jwt_key():
    return hmac.new(secret().encode(), b"aegis-jwt-v1", hashlib.sha256).hexdigest()


# Проверяем введённый пароль по Argon2-хешу, не сравнивая пароль с открытым текстом.
def verify(password, stored):
    try:
        return hasher.verify(stored, password)
    except VerificationError:
        return False


# Связываем запись с предыдущей HMAC-подписью. PostgreSQL-блокировка сериализует параллельную запись цепочки.
def audit(db, user_id, action):
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(8142026003)"))
    previous = db.scalar(select(Audit).order_by(Audit.id.desc()).limit(1))
    prev = previous.record_hash if previous else "0" * 64
    stamp = utcnow().isoformat()
    payload = json.dumps([stamp, user_id, action, prev], ensure_ascii=False, separators=(",", ":"))
    digest = hmac.new(secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    db.add(Audit(actor_id=user_id, action=action, time=stamp, prev_hash=prev, record_hash=digest))


# Создаём серверный сеанс и подписанный JWT. Запись в БД позволяет отозвать доступ до истечения токена.
def issue(db, user):
    sid = secrets.token_hex(32)
    expires = utcnow() + timedelta(hours=2)
    session = AuthSession(id=sid, user_id=user.id, expires=expires)
    db.add(session)
    token = jwt.encode(
        {"sub": str(user.id), "jti": sid, "exp": expires, "iat": utcnow(), "iss": "aegisborder"},
        jwt_key(),
        algorithm="HS256",
    )
    return token, session


# После проверки подписи сверяем токен с БД: сеанс, пользователя, отзыв и срок действия.
def resolve(db, token):
    try:
        payload = jwt.decode(
            token,
            jwt_key(),
            algorithms=["HS256"],
            issuer="aegisborder",
            options={"require": ["exp", "sub", "jti", "iat"]},
        )
        session = db.get(AuthSession, payload["jti"])
        user = db.get(User, int(payload["sub"]))
        if (
            not session
            or session.revoked
            or not user
            or not user.active
            or session.user_id != user.id
            or session.expires.replace(tzinfo=timezone.utc) <= utcnow()
        ):
            raise ValueError()
        return user, session
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(401, "Сеанс завершён. Войдите повторно.") from None


# Зависимость FastAPI: извлекает пользователя из запроса и применяет проверки доступа к рабочим маршрутам.
def current(request: Request, db=Depends(get_db)):
    header = request.headers.get("authorization", "")
    token = header[7:] if header.startswith("Bearer ") else request.cookies.get("aegis_session", "")
    if not token:
        raise HTTPException(401, "Требуется вход в систему")
    user, session = resolve(db, token)
    user._access_role = role_info(user.role, db)["base"]
    from .access import inspect

    assessment = inspect(db, request)
    if not assessment["network"]["allowed"] and request.url.path != "/api/v1/auth/logout":
        raise HTTPException(403, assessment["network"]["reason"])
    if user.role == "demo_viewer" and request.method not in ("GET", "HEAD", "OPTIONS"):
        # Only isolated synthetic runs, personal analysis/export and logout may write.
        # Default-deny covers every router, including future administrative endpoints.
        import re

        allowed = request.method == "POST" and (
            request.url.path in (
                "/api/v1/auth/logout", "/api/v1/demo-sessions", "/api/v1/analytics/anomalies",
                "/api/v1/presence/heartbeat", "/api/v1/presence/disconnect", "/api/v1/auth/location",
            )
            or re.fullmatch(r"/api/v1/scenarios/[a-z0-9_-]+", request.url.path)
            or re.fullmatch(r"/api/v1/reports/\d+", request.url.path)
        )
        if not allowed:
            raise HTTPException(403, "Демонстрационный просмотр: изменение постоянных данных запрещено")
    request.state.session = session
    from .dlp_gate import enforce
    enforce(db, user, session, request.url.path)
    return user


def admin(user=Depends(current)):
    if not is_admin(user):
        raise HTTPException(403, "Требуются права администратора")
    return user


def user_manager(user=Depends(current)):
    if not manages_users(user):
        raise HTTPException(403, "Требуются права управления сотрудниками")
    return user


def operator(user=Depends(current)):
    if role_base(user) not in ("admin", "analyst", "demo", "demo_viewer"):
        raise HTTPException(403, "Доступ только для чтения")
    return user


def visible(query, model, user):
    # Demo accounts never see global or foreign-session records.
    if user.role in ("demo", "demo_viewer"):
        return query.where(model.owner_id == user.id)
    if hasattr(model, "demo_id"):
        return query.where((model.demo_id.is_(None)) | (model.owner_id == user.id))
    return query


def owned_demo(db, demo_id, user):
    from .models import DemoSession

    row = db.get(DemoSession, demo_id)
    if not row or row.owner_id != user.id:
        raise HTTPException(404, "Учебный сеанс не найден")
    return row
