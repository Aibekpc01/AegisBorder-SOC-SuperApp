# Назначение файла: Проверяет подсистему oracle_setup. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import os
import subprocess
import sys
from pathlib import Path


def script(tmp_path):
    target = tmp_path / "scripts" / "create_oracle_env.py"
    target.parent.mkdir()
    target.write_bytes(
        (Path(__file__).resolve().parents[1] / "scripts/create_oracle_env.py").read_bytes()
    )
    return target


def test_oracle_secrets_are_local_hidden_and_never_overwritten(tmp_path):
    target = script(tmp_path)
    first = subprocess.run(
        [sys.executable, str(target), "--domain", "aegisborder.example.com"],
        capture_output=True,
        text=True,
    )
    assert first.returncode == 0
    env = tmp_path / ".env.oracle"
    original = env.read_bytes()
    values = dict(line.split("=", 1) for line in original.decode().splitlines())
    assert values["AEGIS_DOMAIN"] == "aegisborder.example.com"
    for name in ("DB_PASSWORD", "ADMIN_PASSWORD", "AUDIT_KEY"):
        assert len(values[name]) == 64
        assert values[name] not in first.stdout + first.stderr
    if os.name != "nt":
        assert env.stat().st_mode & 0o777 == 0o600
    second = subprocess.run(
        [sys.executable, str(target), "--domain", "other.example.com"],
        capture_output=True,
        text=True,
    )
    assert second.returncode != 0
    assert env.read_bytes() == original


def test_oracle_hostname_rejects_injection_and_url(tmp_path):
    target = script(tmp_path)
    for value in (
        "https://aegisborder.example.com/app",
        "host.test\nDB_PASSWORD=bad",
        "host.test:443",
    ):
        result = subprocess.run(
            [sys.executable, str(target), "--domain", value], capture_output=True, text=True
        )
        assert result.returncode != 0
        assert not (tmp_path / ".env.oracle").exists()
