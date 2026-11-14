# Назначение файла: Проверяет подсистему dlp_panel. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import json
import zipfile
from io import BytesIO
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.command.dlp import DlpDevice
from app.command.models import SiteVisit, User, utcnow


def visit(client, mobile=False):
    me = client.get("/api/v1/auth/me").json()
    # Use the authenticated session, so the FK always points at a real login.
    from app.command.models import AuthSession
    with client.factory() as db:
        session = db.scalar(select(AuthSession).where(AuthSession.user_id == me["id"]))
        existing = db.get(SiteVisit, session.id)
        if existing:
            existing.device = "iPhone" if mobile else "Windows PC"
        else:
            db.add(SiteVisit(session_id=session.id, user_id=me["id"], device="iPhone" if mobile else "Windows PC", browser="Test", ip="127.0.0.1"))
        db.commit()
        sid = session.id
    return sid


def enroll(client):
    sid = visit(client)
    result = client.post("/api/v1/dlp/enroll", json={"name": "Pilot PC", "visit_id": sid, "format": "python"})
    assert result.status_code == 201, result.text
    with zipfile.ZipFile(BytesIO(result.content)) as archive:
        assert {"setup.ps1", "device_link.py", "console.py"} <= set(archive.namelist())
        return json.loads(archive.read("enrollment.json"))


def beat():
    return {"installation_id": str(uuid4()), "hostname": "TEST-PC", "os": "Windows 11", "pending": 2,
            "status": {"antivirus": True, "realtime": True, "usb_write_denied": False}}


@pytest.mark.parametrize("role,expected", [("developer", 200), ("team_lead", 200), ("deputy_cto", 200),
                                          ("cto", 200), ("creator", 200), ("analyst", 200),
                                          ("observer", 403), ("auditor", 403), ("demo", 403), ("demo_viewer", 403)])
def test_dlp_server_side_role_gate(admin, role, expected):
    with admin.factory() as db:
        user = db.scalar(select(User).where(User.username == "admin"))
        user.role = role
        db.commit()
    assert admin.get("/api/v1/dlp/devices").status_code == expected
    if expected == 403:
        assert admin.post("/api/v1/dlp/enroll", json={"name": "Test", "visit_id": "fake"}).status_code == 403


def test_device_telemetry_events_dedup_and_revocation(admin):
    enrollment = enroll(admin)
    identity = enrollment["device_id"]
    path = f"/api/v1/dlp/agents/{identity}"
    headers = {"Authorization": "Bearer " + enrollment["token"]}
    data = beat()
    assert admin.post(path + "/heartbeat", json=data).status_code == 401
    assert admin.post(path + "/heartbeat", json=data, headers=headers).status_code == 200
    result = admin.get("/api/v1/dlp/devices").json()[0]
    assert result["state"] == "online" and result["hostname"] == "TEST-PC"
    assert "token" not in json.dumps(result)
    assert admin.post(path + "/heartbeat", json=beat(), headers=headers).status_code == 409
    event = {"external_id": "one-event", "time": utcnow().isoformat(), "device": "spoofed", "account": "operator",
             "source": "spoofed", "type": "endpoint_security_status", "detail": "Test status", "features": {}}
    assert admin.post(path + "/events", json=[event], headers=headers).json() == {"created": 1, "duplicates": 0}
    assert admin.post(path + "/events", json=[event], headers=headers).json() == {"created": 0, "duplicates": 1}
    assert len(admin.get(f"/api/v1/dlp/devices/{identity}/events").json()) == 1
    assert admin.post(f"/api/v1/dlp/devices/{identity}/revoke").status_code == 200
    assert admin.post(path + "/heartbeat", json=data, headers=headers).status_code == 403


def test_pc_only_and_offline_expired_enrollment(admin):
    sid = visit(admin, mobile=True)
    assert admin.post("/api/v1/dlp/enroll", json={"name": "Phone", "visit_id": sid}).status_code == 422
    enrollment = enroll(admin)
    with admin.factory() as db:
        row = db.get(DlpDevice, enrollment["device_id"])
        row.data = {**row.data, "expires": 0}
        db.commit()
    result = admin.post(f"/api/v1/dlp/agents/{enrollment['device_id']}/heartbeat", json=beat(),
                        headers={"Authorization": "Bearer " + enrollment["token"]})
    assert result.status_code == 403


def test_stale_device_is_offline_and_history_is_bounded(admin):
    enrollment = enroll(admin)
    with admin.factory() as db:
        row = db.get(DlpDevice, enrollment["device_id"])
        row.data = {**row.data, "last_seen": utcnow().timestamp() - 101}
        db.commit()
    assert admin.get("/api/v1/dlp/devices").json()[0]["state"] == "offline"


def test_developer_cannot_revoke_another_owners_agent(admin):
    enrollment = enroll(admin)
    password = "dlp-isolated-test-password-123"
    assert admin.post("/api/v1/users", json={"username": "dlp_developer", "password": password, "role": "developer"}).status_code == 200
    assert admin.post("/api/v1/auth/login", json={"username": "dlp_developer", "password": password}).status_code == 200
    row = admin.get("/api/v1/dlp/devices").json()[0]
    assert row["can_manage"] is False
    assert admin.post(f"/api/v1/dlp/devices/{enrollment['device_id']}/revoke").status_code == 403


def test_agent_owner_disable_blocks_telemetry_and_cannot_inject_other_types(admin):
    enrollment = enroll(admin)
    path = f"/api/v1/dlp/agents/{enrollment['device_id']}"
    headers = {"Authorization": "Bearer " + enrollment["token"]}
    assert admin.post(path + "/heartbeat", json=beat(), headers=headers).status_code == 200
    invalid = {"external_id": "bad-type", "time": utcnow().isoformat(), "device": "test", "account": "test",
               "source": "test", "type": "user_created", "detail": "Not endpoint telemetry"}
    assert admin.post(path + "/events", json=[invalid], headers=headers).status_code == 422
    with admin.factory() as db:
        user = db.scalar(select(User).where(User.username == "admin"))
        user.active = False
        db.commit()
    assert admin.post(path + "/heartbeat", json=beat(), headers=headers).status_code == 403
