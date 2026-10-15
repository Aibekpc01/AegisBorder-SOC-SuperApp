"""Run locally by the machine operator after stopping the application."""

import argparse
import getpass
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


def main():
    root = Path(__file__).resolve().parents[1]
    os.chdir(root)
    sys.path.insert(0, str(root))
    load_dotenv(root / ".env")
    parser = argparse.ArgumentParser(
        description="Офлайн-восстановление существующего администратора"
    )
    parser.add_argument("--username", default="admin")
    args = parser.parse_args()
    print("Остановите приложение и сохраните резервную копию базы перед восстановлением.")
    if input("Введите имя восстанавливаемого администратора для подтверждения: ") != args.username:
        raise SystemExit("Восстановление отменено")
    password = getpass.getpass("Новый пароль (12–128 символов): ")
    if password != getpass.getpass("Повторите пароль: "):
        raise SystemExit("Пароли не совпадают")
    from app.command.db import SessionLocal
    from app.command.recovery import recover_admin

    try:
        with SessionLocal() as db:
            recover_admin(db, args.username, password)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    print("Доступ восстановлен. Предыдущие сеансы отозваны. Операция записана в аудит.")


if __name__ == "__main__":
    main()
