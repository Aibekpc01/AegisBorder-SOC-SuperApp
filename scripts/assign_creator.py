# Назначение файла: Назначает учётной записи роль создателя через административный сценарий.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""One-time owner assignment by the server operator. No public bootstrap endpoint."""
import argparse
import os
import sys
from pathlib import Path


def assign(db, username):
    from sqlalchemy import select

    from app.command.governance import manager_lock, revoke_sessions
    from app.command.models import User
    from app.command.security import audit
    row = db.scalar(select(User).where(User.username == username))
    if not row or not row.active or row.role != "admin":
        raise ValueError("Требуется существующий действующий администратор")
    manager_lock(db, row)
    if db.scalar(select(User.id).where(User.role == "creator")):
        raise ValueError("Создатель уже назначен; используйте управление ролями")
    row.role = "creator"
    revoke_sessions(db, row.id)
    audit(db, row.id, "Оператор сервера назначил первоначального создателя; пароль сохранён, сеансы отозваны")
    db.commit()


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    os.chdir(root)
    sys.path.insert(0, str(root))
    from dotenv import load_dotenv
    load_dotenv(root / ".env")
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    args = parser.parse_args()
    from app.command.db import SessionLocal
    with SessionLocal() as db:
        assign(db, args.username)
    print("Создатель назначен. Пароль не изменён. Войдите повторно.")
