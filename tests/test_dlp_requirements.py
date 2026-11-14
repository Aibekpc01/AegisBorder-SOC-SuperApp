# Назначение файла: Проверяет, что DLP по умолчанию не нужен, а администратор включает его конкретному пользователю.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import os

PASSWORD = "Requirement-Test-2026!"


def login(client, name):
    password = os.environ["ADMIN_PASSWORD"] if name == "admin" else PASSWORD
    assert client.post("/api/v1/auth/login", json={"username": name, "password": password}).status_code == 200


def create(admin, name, role):
    response = admin.post("/api/v1/users", json={"username": name, "role": role, "password": PASSWORD})
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


def test_dlp_not_required_by_default_and_admin_toggles_it(admin, monkeypatch):
    monkeypatch.setenv("DLP_ENFORCE", "true")
    analyst = create(admin, "dlp_analyst", "analyst")
    listing = {u["username"]: u for u in admin.get("/api/v1/dlp/requirements").json()}
    assert listing["dlp_analyst"]["required"] is False and listing["dlp_analyst"]["editable"]
    assert listing["admin"]["editable"] is False  # себя ограничить нельзя

    login(admin, "dlp_analyst")
    assert admin.get("/api/v1/dlp/access").json()["required"] is False
    assert admin.get("/api/v1/events").status_code == 200
    # Обычный пользователь не может назначать требование.
    assert admin.get("/api/v1/dlp/requirements").status_code == 403
    assert admin.put(f"/api/v1/dlp/requirements/{analyst}", json={"required": False}).status_code == 403

    login(admin, "admin")
    assert admin.put(f"/api/v1/dlp/requirements/{analyst}", json={"required": True}).status_code == 200
    login(admin, "dlp_analyst")
    assert admin.get("/api/v1/dlp/access").json()["required"] is True
    assert admin.get("/api/v1/events").status_code == 428

    login(admin, "admin")
    assert admin.put(f"/api/v1/dlp/requirements/{analyst}", json={"required": False}).status_code == 200
    login(admin, "dlp_analyst")
    assert admin.get("/api/v1/events").status_code == 200

    login(admin, "admin")
    actions = [a["action"] for a in admin.get("/api/v1/audit").json()]
    assert any("включено обязательное подключение" in a for a in actions)
    assert any("снято обязательное подключение" in a for a in actions)
    assert admin.get("/api/v1/audit/verify").json()["valid"]


def test_requirement_respects_roles_and_hierarchy(admin):
    observer = create(admin, "dlp_observer", "observer")
    me = admin.get("/api/v1/auth/me").json()["id"]
    # Агент DLP недоступен наблюдателю — требование не назначается.
    assert admin.put(f"/api/v1/dlp/requirements/{observer}", json={"required": True}).status_code == 422
    # Себя ограничить нельзя, чтобы администратор не заблокировал собственный доступ.
    assert admin.put(f"/api/v1/dlp/requirements/{me}", json={"required": True}).status_code == 409
    assert admin.put("/api/v1/dlp/requirements/999999", json={"required": True}).status_code == 404
