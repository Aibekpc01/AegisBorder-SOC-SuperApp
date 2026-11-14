# Назначение файла: Проверяет подсистему dlp_enforcement. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import hashlib
import hmac
import json
import zipfile
from io import BytesIO
from uuid import uuid4

from sqlalchemy import select

from app.command.dlp import DlpDevice
from app.command.models import AuthSession, Setting, SiteVisit, User, utcnow


def prepare(admin, monkeypatch, assigned=True):
    me = admin.get("/api/v1/auth/me").json()
    with admin.factory() as db:
        session = db.scalar(select(AuthSession).where(AuthSession.user_id == me["id"]).order_by(AuthSession.expires.desc()))
        db.add(SiteVisit(session_id=session.id, user_id=me["id"], device="Windows test fixture", browser="Test", ip="127.0.0.1"))
        db.commit()
        sid = session.id
    monkeypatch.setenv("DLP_ENFORCE", "true")
    if assigned:
        assert admin.post("/api/v1/dlp/assign", json={"visit_id": sid}).status_code == 200
    package = admin.post("/api/v1/dlp/enroll", json={"name": "NATIVE TEST FIXTURE", "visit_id": sid})
    assert package.status_code == 201, package.text
    with zipfile.ZipFile(BytesIO(package.content)) as archive:
        assert set(archive.namelist()) == {"AegisDLP.exe", "README.txt", "enrollment.json"}
        assert archive.read("AegisDLP.exe").startswith(b"MZ")
        enrollment = json.loads(archive.read("enrollment.json"))
    path = f"/api/v1/dlp/agents/{enrollment['device_id']}"
    headers = {"Authorization": "Bearer " + enrollment["token"]}
    beat = {"installation_id": str(uuid4()), "hostname": "TEST-FIXTURE", "os": "Windows test fixture",
            "status": {"antivirus": True}, "pending": 0, "agent_version": "2.0.0-native", "service_mode": True, "policy_version": 1}
    return enrollment, path, headers, beat


def confirm(admin, path, headers, source="loopback"):
    code = admin.post("/api/v1/dlp/pair-code").json()["code"]
    result = admin.post(path + "/pair", headers=headers, json={"code": code, "source": source})
    assert result.status_code == 200, result.text
    return code


def test_mandatory_gate_cannot_be_bypassed_by_direct_api_or_manual_pair(admin, monkeypatch):
    _, path, headers, beat = prepare(admin, monkeypatch)
    assert admin.get("/api/v1/dlp/access").json()["required"]
    for route in ("/dashboard", "/events", "/settings", "/users"):
        assert admin.get("/api/v1" + route).status_code == 428
    assert admin.get("/api/v1/presence/devices").status_code == 200
    assert admin.post(path + "/heartbeat", headers=headers, json=beat).status_code == 200
    confirm(admin, path, headers, "manual")
    assert admin.get("/api/v1/dashboard").status_code == 428
    code = confirm(admin, path, headers)
    assert admin.get("/api/v1/dashboard").status_code == 200
    assert admin.post(path + "/pair", headers=headers, json={"code": code, "source": "loopback"}).status_code == 403


def test_agent_in_another_login_does_not_unlock_new_session_and_stale_agent_blocks(admin, monkeypatch):
    enrollment, path, headers, beat = prepare(admin, monkeypatch)
    admin.post(path + "/heartbeat", headers=headers, json=beat)
    confirm(admin, path, headers)
    assert admin.get("/api/v1/dashboard").status_code == 200
    assert admin.post("/api/v1/auth/login", json={"username": "admin", "password": "test-admin-password-123"}).status_code == 200
    assert admin.get("/api/v1/dashboard").status_code == 428
    confirm(admin, path, headers)
    with admin.factory() as db:
        row = db.get(DlpDevice, enrollment["device_id"])
        row.data = {**row.data, "last_seen": utcnow().timestamp() - 101}
        db.commit()
    assert admin.get("/api/v1/dashboard").status_code == 428


def test_policy_signature_and_applied_version_control_access(admin, monkeypatch):
    enrollment, path, headers, beat = prepare(admin, monkeypatch)
    response = admin.post(path + "/heartbeat", headers=headers, json=beat).json()
    key = hashlib.sha256((enrollment["token"] + ":policy").encode()).digest()
    assert hmac.compare_digest(hmac.new(key, response["policy_json"].encode(), hashlib.sha256).hexdigest(), response["policy_signature"])
    confirm(admin, path, headers)
    assert admin.get("/api/v1/dashboard").status_code == 200
    assert admin.post(f"/api/v1/dlp/devices/{enrollment['device_id']}/policy", json={"usb_mode": "block"}).status_code == 200
    assert admin.get("/api/v1/dashboard").status_code == 428
    beat["policy_version"] = 2
    beat["policy_error"] = "AccessDenied"
    admin.post(path + "/heartbeat", headers=headers, json=beat)
    assert admin.get("/api/v1/dashboard").status_code == 428
    beat["policy_error"] = None
    admin.post(path + "/heartbeat", headers=headers, json=beat)
    assert admin.get("/api/v1/dashboard").status_code == 200
    beat["service_mode"] = False
    admin.post(path + "/heartbeat", headers=headers, json=beat)
    assert admin.get("/api/v1/dashboard").status_code == 428


def test_roles_optional_until_leadership_assignment(admin, monkeypatch):
    enrollment, _, _, _ = prepare(admin, monkeypatch, assigned=False)
    with admin.factory() as db:
        sid = db.get(DlpDevice, enrollment["device_id"]).data["visit_id"]
    for role in ("creator", "cto", "admin", "team_lead", "analyst", "developer"):
        with admin.factory() as db:
            user = db.scalar(select(User).where(User.username == "admin"))
            user.role = role
            db.commit()
        assert admin.get("/api/v1/dlp/access").json()["required"] is False
        assert admin.get("/api/v1/dashboard").status_code == 200
        if role in ("analyst", "developer"):
            assert admin.post("/api/v1/dlp/assign", json={"visit_id": sid}).status_code == 403
    with admin.factory() as db:
        user = db.scalar(select(User).where(User.username == "admin"))
        user.role = "creator"
        db.commit()
    assert admin.post("/api/v1/dlp/assign", json={"visit_id": sid}).status_code == 200
    assert admin.get("/api/v1/dashboard").status_code == 428


def test_scan_command_acknowledgement_and_developer_cannot_change_policy(admin, monkeypatch):
    enrollment, path, headers, beat = prepare(admin, monkeypatch)
    identity = enrollment["device_id"]
    command = admin.post(f"/api/v1/dlp/devices/{identity}/quick-scan").json()
    assert command["status"] == "pending"
    response = admin.post(path + "/heartbeat", headers=headers, json=beat).json()
    assert response["commands"][0]["id"] == command["id"]
    beat["command_results"] = {command["id"]: "started"}
    assert admin.post(path + "/heartbeat", headers=headers, json=beat).json()["commands"] == []
    assert admin.get("/api/v1/dlp/devices").json()[0]["commands"][0]["status"] == "started"
    with admin.factory() as db:
        user = db.scalar(select(User).where(User.username == "admin"))
        user.role = "developer"
        db.commit()
    assert admin.post(f"/api/v1/dlp/devices/{identity}/policy", json={"usb_mode": "block"}).status_code == 403


def test_shared_pc_has_one_agent_but_separate_operator_session_confirmation(admin, monkeypatch):
    _, path, headers, beat = prepare(admin, monkeypatch)
    admin.post(path + "/heartbeat", headers=headers, json=beat)
    confirm(admin, path, headers)
    password = "shared-pc-test-password-123"
    assert admin.post("/api/v1/users", json={"username": "shift_operator", "password": password, "role": "analyst"}).status_code == 200
    assert admin.post("/api/v1/auth/login", json={"username": "shift_operator", "password": password}).status_code == 200
    with admin.factory() as db:
        target = db.scalar(select(User).where(User.username == "shift_operator"))
        owner = db.scalar(select(User).where(User.username == "admin"))
        db.add(Setting(key=f"dlp-required:{target.id}", value={"required": True, "assigned_by": owner.id}))
        db.commit()
    assert admin.get("/api/v1/dashboard").status_code == 428
    code = admin.post("/api/v1/dlp/pair-code").json()["code"]
    assert admin.post(path + "/pair", headers=headers, json={"code": code, "source": "manual"}).status_code == 403
    assert admin.post(path + "/pair", headers=headers, json={"code": code, "source": "loopback"}).status_code == 200
    assert admin.get("/api/v1/dashboard").status_code == 200
    with admin.factory() as db:
        owner = db.scalar(select(User).where(User.username == "admin"))
        owner.active = False
        db.commit()
    assert admin.get("/api/v1/dashboard").status_code == 428
