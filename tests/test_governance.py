# Назначение файла: Проверяет подсистему governance. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import zipfile
from io import BytesIO

import pytest
from sqlalchemy import select

from app.command.models import User
from scripts.assign_creator import assign

PASSWORD = "governance-password-123"


def login(client, name="admin"):
    response = client.post("/api/v1/auth/login", json={"username": name, "password": "test-admin-password-123" if name == "admin" else PASSWORD})
    assert response.status_code == 200
    return response.json()


def owner(admin):
    with admin.factory() as db:
        before = db.scalar(select(User).where(User.username == "admin")).password_hash
        assign(db, "admin")
        assert db.scalar(select(User).where(User.username == "admin")).password_hash == before
    assert admin.get("/api/v1/auth/me").status_code == 401
    return login(admin)


def create(admin, name, role):
    r = admin.post("/api/v1/users", json={"username": name, "role": role, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()


def test_creator_assignment_preserves_password_and_operator_features(admin):
    me = owner(admin)
    assert me["role"] == "creator" and me["access_role"] == "admin"
    assert me["permissions"]["assign_creator"]
    assert admin.get("/api/v1/users").status_code == 200
    assert admin.get("/api/v1/governance/overview").status_code == 200
    assert any(o["id"] == me["id"] for o in admin.get("/api/v1/operators").json())
    assert admin.post("/api/v1/workspace/documents", json={"title": "Creator document"}).status_code == 201
    assert admin.delete(f"/api/v1/users/{me['id']}").status_code == 409


def test_cto_cannot_take_over_creator_or_assign_top_roles(admin):
    me = owner(admin)
    cto = create(admin, "test_cto", "cto")
    login(admin, "test_cto")
    assert admin.get("/api/v1/settings").status_code == 200
    assert admin.patch(f"/api/v1/users/{me['id']}", json={"password": PASSWORD}).status_code == 403
    assert admin.delete(f"/api/v1/users/{me['id']}").status_code == 403
    assert admin.put(f"/api/v1/users/{me['id']}/profile", json={"full_name": "changed"}).status_code == 403
    assert admin.post("/api/v1/users", json={"username": "fake_creator", "password": PASSWORD, "role": "creator"}).status_code == 403
    assert admin.post("/api/v1/roles", json={"name": "fake_admin", "label": "Bad escalation", "base": "admin"}).status_code == 403
    assert admin.patch(f"/api/v1/users/{cto['id']}", json={"role": "creator"}).status_code == 409


@pytest.mark.parametrize("role", ["admin", "cto"])
def test_employee_shortcut_respects_hierarchy_and_allows_own_profile(admin, role):
    creator = owner(admin)
    manager = create(admin, "profile_manager", role)
    employee = create(admin, "profile_employee", "observer")
    original = {"full_name": "Создатель проекта", "department": "Руководство", "position": "Создатель"}
    assert admin.patch(f"/api/v1/presence/employees/{creator['id']}", json=original).status_code == 200
    login(admin, "profile_manager")
    changed = {"full_name": "Недопустимая замена", "department": "Другой отдел", "position": "Сотрудник"}
    assert admin.patch(f"/api/v1/presence/employees/{creator['id']}", json=changed).status_code == 403
    profile = admin.get(f"/api/v1/users/{creator['id']}/profile").json()["profile"]
    assert profile["full_name"] == original["full_name"]
    assert admin.patch(f"/api/v1/presence/employees/{manager['id']}", json=changed).status_code == 200
    assert admin.patch(f"/api/v1/presence/employees/{employee['id']}", json=changed).status_code == 200


def test_custom_role_permissions_assignment_and_safe_deletion(admin):
    owner(admin)
    role = {"name": "incident_reviewer", "label": "Проверяющий", "base": "analyst"}
    assert admin.post("/api/v1/roles", json=role).status_code == 201
    person = create(admin, "custom_member", role["name"])
    assert person["role_label"] == role["label"] and person["access_role"] == "analyst"
    assert admin.delete("/api/v1/roles/incident_reviewer").status_code == 409
    login(admin, "custom_member")
    assert admin.get("/api/v1/users").status_code == 403
    assert admin.post("/api/v1/workspace/documents", json={"title": "Allowed analyst document"}).status_code == 201
    assert admin.put("/api/v1/settings", json={"organization": "Denied"}).status_code == 403
    login(admin)
    assert admin.patch(f"/api/v1/users/{person['id']}", json={"role": "observer"}).status_code == 200
    assert admin.delete("/api/v1/roles/incident_reviewer").status_code == 200
    assert admin.delete("/api/v1/roles/creator").status_code == 409


def test_delete_restore_and_session_revocation_keep_owned_documents(admin):
    owner(admin)
    person = create(admin, "delete_member", "analyst")
    login(admin, "delete_member")
    doc = admin.post("/api/v1/workspace/documents", json={"title": "Historical evidence"}).json()
    login(admin)
    assert admin.delete(f"/api/v1/users/{person['id']}").status_code == 200
    assert all(p["id"] != person["id"] for p in admin.get("/api/v1/users").json())
    assert any(p["id"] == person["id"] for p in admin.get("/api/v1/users?state=deleted").json())
    assert admin.get(f"/api/v1/workspace/documents/{doc['id']}").status_code == 200
    assert admin.patch(f"/api/v1/users/{person['id']}/active").status_code == 409
    assert admin.post(f"/api/v1/users/{person['id']}/restore").status_code == 200
    restored = next(p for p in admin.get("/api/v1/users").json() if p["id"] == person["id"])
    assert not restored["active"]
    assert admin.patch(f"/api/v1/users/{person['id']}/active").status_code == 200
    assert admin.get("/api/v1/audit/verify").json()["valid"]


def test_deputy_can_manage_lower_roles_but_developer_is_read_only(admin):
    owner(admin)
    chief = create(admin, "chief", "cto")
    create(admin, "deputy", "deputy_cto")
    dev = create(admin, "developer_member", "developer")
    login(admin, "deputy")
    assert admin.get("/api/v1/users").status_code == 200
    assert admin.delete(f"/api/v1/users/{chief['id']}").status_code == 403
    assert admin.patch(f"/api/v1/users/{dev['id']}/active").status_code == 200
    assert admin.patch(f"/api/v1/users/{dev['id']}/active").status_code == 200
    assert admin.post("/api/v1/roles", json={"name": "denied_role", "label": "No access", "base": "observer"}).status_code == 403
    login(admin, "developer_member")
    assert admin.get("/api/v1/users").status_code == 403
    assert admin.post("/api/v1/workspace/documents", json={"title": "Denied"}).status_code == 403
    assert admin.get("/api/v1/governance/agent-package").status_code == 403


def test_role_change_revokes_existing_session_and_unknown_role_rejected(admin):
    person = create(admin, "session_member", "analyst")
    login(admin, "session_member")
    session_cookie = admin.cookies.get("aegis_session")
    login(admin)
    assert admin.patch(f"/api/v1/users/{person['id']}", json={"role": "observer"}).status_code == 200
    assert admin.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + session_cookie}).status_code == 401
    assert admin.post("/api/v1/users", json={"username": "unknown_role_user", "password": PASSWORD, "role": "not_existing"}).status_code == 422


def test_generated_avatar_and_agent_package(admin):
    me = admin.get("/api/v1/auth/me").json()
    path = f"/api/v1/users/{me['id']}/avatar"
    preview = admin.get(path + "/presets/7")
    assert preview.status_code == 200 and preview.content.startswith(b"\x89PNG")
    assert admin.post(path + "/generate", json={"variant": 7}).status_code == 200
    assert admin.get(path).content == preview.content
    assert admin.post(path + "/generate", json={"variant": 1000000}).status_code == 422
    package = admin.get("/api/v1/governance/agent-package")
    assert package.status_code == 200
    with zipfile.ZipFile(BytesIO(package.content)) as archive:
        assert set(archive.namelist()) == {"README.md", "endpoint_agent.py", "local_security.py", "usb_policy.py", "console.py", "device_link.py", "setup.ps1", "requirements.txt"}
