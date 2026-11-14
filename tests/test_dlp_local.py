# Назначение файла: Проверяет подсистему dlp_local. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import json

import pytest

from agents.windows import endpoint_agent
from agents.windows.local_security import authenticate, new_password, save_json
from agents.windows.usb_policy import VALUES, block, restore


def test_password_lockout_persists_and_expires_without_network(tmp_path):
    config = {"password_hash": new_password("a-strong-local-password", "a-strong-local-password")}
    path = tmp_path / "login.json"
    for _ in range(5):
        with pytest.raises(ValueError, match="Incorrect"):
            authenticate(config, "wrong", path, now=100)
    with pytest.raises(ValueError, match="Too many"):
        authenticate(config, "a-strong-local-password", path, now=101)
    authenticate(config, "a-strong-local-password", path, now=401)
    assert json.loads(path.read_text())["failures"] == 0


def test_short_or_mismatched_passwords_rejected():
    for password, confirmation in [("1234", "1234"), ("long-password", "different-password")]:
        with pytest.raises(ValueError):
            new_password(password, confirmation)


class Registry:
    HKEY_LOCAL_MACHINE = KEY_READ = KEY_WRITE = REG_DWORD = 1

    def __init__(self):
        self.values = {"Deny_Read": 0}

    def CreateKeyEx(self, *args):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def QueryValueEx(self, key, name):
        if name not in self.values:
            raise FileNotFoundError
        return self.values[name], self.REG_DWORD

    def SetValueEx(self, key, name, reserved, kind, value):
        self.values[name] = value

    def DeleteValue(self, key, name):
        if name not in self.values:
            raise FileNotFoundError
        del self.values[name]


def test_disk_policy_backup_and_exact_restore(tmp_path):
    reg = Registry()
    path = tmp_path / "usb-backup.json"
    block(path, save_json, reg)
    assert reg.values == dict.fromkeys(VALUES, 1)
    with pytest.raises(ValueError):
        block(path, save_json, reg)
    restore(path, reg)
    assert reg.values == {"Deny_Read": 0}
    assert not path.exists()


def test_missing_or_invalid_backup_cannot_relax_policy(tmp_path):
    path = tmp_path / "usb-backup.json"
    reg = Registry()
    with pytest.raises(FileNotFoundError):
        restore(path, reg)
    save_json(path, {"Deny_Read": 0})
    with pytest.raises(ValueError):
        restore(path, reg)
    assert reg.values == {"Deny_Read": 0}


def test_offline_init_and_collect_need_no_server_or_login_each_cycle(tmp_path, monkeypatch):
    import sys

    monkeypatch.setattr(sys, "argv", ["agent", "init", "--data-dir", str(tmp_path)])
    monkeypatch.setattr(endpoint_agent.getpass, "getpass", lambda _: "a-strong-local-password")
    endpoint_agent.main()
    config = json.loads((tmp_path / "settings.json").read_text(encoding="utf-8"))
    assert config["endpoint"] is None
    assert "a-strong-local-password" not in (tmp_path / "settings.json").read_text()
    monkeypatch.setattr(sys, "argv", ["agent", "once", "--data-dir", str(tmp_path)])
    monkeypatch.setattr(endpoint_agent, "collect", lambda: {"status": {}, "threats": []})

    def forbidden(*args, **kwargs):
        raise AssertionError("Offline collection must not connect or prompt")

    monkeypatch.setattr(endpoint_agent, "send_pending", forbidden)
    monkeypatch.setattr(endpoint_agent.getpass, "getpass", forbidden)
    endpoint_agent.main()
    with endpoint_agent.queue_open(tmp_path / "queue.sqlite") as db:
        assert db.execute("SELECT count(*) FROM events WHERE sent=0").fetchone()[0] == 1
