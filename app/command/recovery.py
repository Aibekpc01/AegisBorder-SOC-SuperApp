# Назначение файла: Обслуживает восстановление доступа и проверку условий безопасного изменения учётных данных.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Offline administrator password recovery, with session revocation and audit."""

from sqlalchemy import select, update

from .models import AuthSession, User
from .rbac import role_base
from .security import audit, hasher


def recover_admin(db, username: str, password: str):
    if not 12 <= len(password) <= 128:
        raise ValueError("Пароль должен содержать от 12 до 128 символов")
    user = db.scalar(select(User).where(User.username == username).with_for_update())
    if not user or role_base(user, db) != "admin":
        raise ValueError("Существующий администратор не найден")
    from .governance import deleted
    if deleted(db, user.id):
        raise ValueError("Сначала восстановите пользователя из корзины")
    user.password_hash = hasher.hash(password)
    user.active = True
    db.execute(update(AuthSession).where(AuthSession.user_id == user.id).values(revoked=True))
    audit(db, user.id, "Офлайн-восстановление доступа администратора; все его сеансы отозваны")
    db.commit()
