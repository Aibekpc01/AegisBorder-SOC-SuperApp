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

hasher = PasswordHasher()


def secret():
    key = os.getenv("AUDIT_KEY", "")
    if len(key) < 32:
        raise RuntimeError("AUDIT_KEY должен содержать не менее 32 символов")
    return key


def jwt_key():
    return hmac.new(secret().encode(), b"aegis-jwt-v1", hashlib.sha256).hexdigest()


def verify(password, stored):
    try:
        return hasher.verify(stored, password)
    except VerificationError:
        return False


def audit(db, user_id, action):
    if db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(8142026003)"))
    previous = db.scalar(select(Audit).order_by(Audit.id.desc()).limit(1))
    prev = previous.record_hash if previous else "0" * 64
    stamp = utcnow().isoformat()
    payload = json.dumps([stamp, user_id, action, prev], ensure_ascii=False, separators=(",", ":"))
    digest = hmac.new(secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    db.add(Audit(actor_id=user_id, action=action, time=stamp, prev_hash=prev, record_hash=digest))


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


def current(request: Request, db=Depends(get_db)):
    header = request.headers.get("authorization", "")
    token = header[7:] if header.startswith("Bearer ") else request.cookies.get("aegis_session", "")
    if not token:
        raise HTTPException(401, "Требуется вход в систему")
    user, session = resolve(db, token)
    from .access import inspect

    assessment = inspect(db, request)
    if not assessment["network"]["allowed"] and request.url.path != "/api/v1/auth/logout":
        raise HTTPException(403, assessment["network"]["reason"])
    request.state.session = session
    return user


def admin(user=Depends(current)):
    if user.role != "admin":
        raise HTTPException(403, "Требуются права администратора")
    return user


def operator(user=Depends(current)):
    if user.role not in ("admin", "analyst", "demo"):
        raise HTTPException(403, "Доступ только для чтения")
    return user


def visible(query, model, user):
    # Demo accounts never see global or foreign-session records.
    if user.role == "demo":
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
