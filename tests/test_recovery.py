# Назначение файла: Проверяет подсистему recovery. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import pytest
from sqlalchemy import select

from app.command.models import AuthSession, User
from app.command.recovery import recover_admin
from app.command.security import verify


def test_recovery_revokes_sessions_and_preserves_identity(admin):
    with admin.factory() as db:
        user = db.scalar(select(User).where(User.username == "admin"))
        identity = user.id
        recover_admin(db, "admin", "new-recovery-password-123")
        assert user.id == identity and user.role == "admin" and user.active
        assert verify("new-recovery-password-123", user.password_hash)
        assert all(
            s.revoked
            for s in db.scalars(select(AuthSession).where(AuthSession.user_id == identity))
        )
    assert admin.get("/api/v1/auth/me").status_code == 401
    assert (
        admin.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "new-recovery-password-123"},
        ).status_code
        == 200
    )
    assert admin.get("/api/v1/audit/verify").json()["valid"]


def test_recovery_cannot_promote_non_admin_or_accept_short_password(admin):
    admin.post(
        "/api/v1/users",
        json={
            "username": "observer_recovery",
            "role": "observer",
            "password": "observer-password-123",
        },
    )
    with admin.factory() as db:
        with pytest.raises(ValueError):
            recover_admin(db, "admin", "short")
        with pytest.raises(ValueError):
            recover_admin(db, "observer_recovery", "valid-password-long")
        with pytest.raises(ValueError):
            recover_admin(db, "missing", "valid-password-long")
        assert (
            db.scalar(select(User).where(User.username == "observer_recovery")).role == "observer"
        )
