# Назначение файла: Готовит окружение для публичной демонстрации.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Generate separate local credentials, never print secrets."""

import secrets
from pathlib import Path

target = Path(__file__).resolve().parents[1] / ".env.public-demo"
if target.exists():
    raise SystemExit(".env.public-demo already exists; existing credentials preserved")
with target.open("x", encoding="utf-8") as stream:
    for name in ("DB_PASSWORD", "ADMIN_PASSWORD", "AUDIT_KEY"):
        stream.write(f"{name}={secrets.token_hex(32)}\n")
    stream.write("PUBLIC_ORIGIN=\n")
print("Separate credentials saved to .env.public-demo; do not publish this file")
