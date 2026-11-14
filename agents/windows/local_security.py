# Назначение файла: Хранит вспомогательные операции локальной защиты и работы с секретами Python-агента.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Local Aegis DLP authentication. No network dependency or embedded password."""
import json
import os
import time
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError


def save_json(path, value):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, path)


def authenticate(config, password, state_path, now=None):
    now = time.time() if now is None else now
    path = Path(state_path)
    state = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    if state.get("blocked_until", 0) > now:
        raise ValueError("Too many attempts. Try again in five minutes.")
    try:
        PasswordHasher().verify(config["password_hash"], password)
    except VerificationError:
        failures = state.get("failures", 0) + 1
        save_json(path, {"failures": failures, "blocked_until": now + 300 if failures >= 5 else 0})
        raise ValueError("Incorrect Aegis DLP password") from None
    save_json(path, {"failures": 0, "blocked_until": 0})


def new_password(password, confirmation):
    if len(password) < 12 or password != confirmation:
        raise ValueError("Use at least 12 characters and matching confirmation")
    return PasswordHasher().hash(password)
