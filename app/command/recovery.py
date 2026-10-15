"""Offline administrator password recovery, with session revocation and audit."""

from sqlalchemy import select, update

from .models import AuthSession, User
from .security import audit, hasher


def recover_admin(db, username: str, password: str):
    if not 12 <= len(password) <= 128:
        raise ValueError("Пароль должен содержать от 12 до 128 символов")
    user = db.scalar(select(User).where(User.username == username).with_for_update())
    if not user or user.role != "admin":
        raise ValueError("Существующий администратор не найден")
    user.password_hash = hasher.hash(password)
    user.active = True
    db.execute(update(AuthSession).where(AuthSession.user_id == user.id).values(revoked=True))
    audit(db, user.id, "Офлайн-восстановление доступа администратора; все его сеансы отозваны")
    db.commit()
