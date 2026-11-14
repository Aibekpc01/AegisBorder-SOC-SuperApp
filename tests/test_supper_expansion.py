# Назначение файла: Проверяет подсистему supper_expansion. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.


from app.command import news as news_module
from app.command.models import utcnow


def test_presence_multiple_tabs_disconnect_and_device_location(admin):
    base = "/api/v1/presence"
    for tab in ("tab-one", "tab-two"):
        assert admin.post(base + "/heartbeat", json={"tab_id": tab, "model": "Samsung SM-S928B"}).status_code == 200
    row = admin.get(base + "/devices").json()["devices"][0]
    assert row["device"] == "Samsung SM-S928B" and row["online"]
    assert admin.post(base + "/disconnect", json={"tab_id": "tab-one"}).status_code == 200
    assert admin.get(base + "/devices").json()["devices"][0]["online"]
    admin.post(base + "/disconnect", json={"tab_id": "tab-two"})
    assert not admin.get(base + "/devices").json()["devices"][0]["online"]
    admin.post(base + "/heartbeat", json={"tab_id": "tab-two"})
    location = admin.post("/api/v1/auth/location", json={"latitude": 43.2389, "longitude": 76.8897, "accuracy": 25, "observed_at": utcnow().isoformat()})
    assert location.status_code == 200
    row = admin.get(base + "/devices").json()["devices"][0]
    assert row["city"] == "Алматы" and row["accuracy"] == 25 and row["online"]
    assert row["city_source"] and row["location_observed_at"]
    from sqlalchemy import select

    from app.command.models import Setting
    with admin.factory() as db:
        assert all(len(key) <= 50 for key in db.scalars(select(Setting.key)))


def test_reported_device_names_do_not_invent_hidden_models():
    from app.command.presence import device_brand, device_name
    assert device_name("Mozilla/5.0 (Linux; Android 10; K) Chrome/120.0")[0] == "Android"
    name, browser = device_name("Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A) Chrome/120.0")
    assert name == "SM-S928B" and browser == "Chrome" and device_brand(name) == "Samsung"
    assert device_brand("Компьютер Windows") == ""


def test_employee_ips_admin_only_and_active_staff_filter(admin):
    for name, role in (("analyst_staff", "analyst"), ("guest_staff", "demo")):
        assert admin.post("/api/v1/users", json={"username": name, "password": "test-password-long", "role": role}).status_code == 200
    admin.post("/api/v1/presence/heartbeat")
    rows = admin.get("/api/v1/presence/participants?staff=true").json()["members"]
    assert len(rows) == 2
    assert any("ip" in r for r in rows)
    assert all(not r["guest"] and r["active"] for r in rows)
    admin.post("/api/v1/auth/logout")
    admin.post("/api/v1/auth/login", json={"username": "analyst_staff", "password": "test-password-long"})
    assert all("ip" not in r for r in admin.get("/api/v1/presence/participants?staff=true").json()["members"])


def test_reviewer_confirms_task_and_history_is_visible(admin):
    reviewer = admin.post("/api/v1/users", json={"username": "reviewer", "password": "test-password-long", "role": "analyst"}).json()
    task = admin.post("/api/v1/superapp/tasks", json={"title": "Проверить факты", "reviewer_id": reviewer["id"]}).json()
    assert task["reviewer_id"] == reviewer["id"]
    path = f"/api/v1/superapp/tasks/{task['id']}"
    for revision, status in ((1, "В работе"), (2, "На проверке")):
        assert admin.patch(path, json={"revision": revision, "status": status}).status_code == 200
    admin.post("/api/v1/auth/logout")
    admin.post("/api/v1/auth/login", json={"username": "reviewer", "password": "test-password-long"})
    assert admin.patch(path, json={"revision": 3, "status": "Завершена"}).status_code == 200
    assert admin.patch(path, json={"revision": 4, "status": "В работе"}).status_code == 403
    history = admin.get(path + "/history").json()
    assert len(history) == 5
    assert any("согласующий" in row["action"] for row in history)
    assert admin.get("/api/v1/audit/verify").json()["valid"]


def test_document_archive_trash_restore_export_and_version_conflict(admin):
    base = "/api/v1/workspace/documents"
    doc = admin.post(base, json={"title": "Материалы для проверки"}).json()
    path = f"{base}/{doc['id']}"
    archived = admin.post(path + "/lifecycle", json={"action": "archive", "revision": 1})
    assert archived.status_code == 200, archived.text
    assert archived.json()["revision"] == 2 and not archived.json()["can_edit"]
    assert admin.get(base).json() == []
    assert admin.get(base + "?state=archived").json()[0]["id"] == doc["id"]
    body = {k: doc[k] for k in ("title", "content", "incident_id", "assignee_id", "status")}
    assert admin.put(path, json={**body, "revision": 2}).status_code == 409
    assert admin.post(path + "/lifecycle", json={"action": "restore", "revision": 1}).status_code == 409
    assert admin.post(path + "/lifecycle", json={"action": "delete", "revision": 2}).status_code == 200
    assert admin.get(base + "?state=deleted").json()[0]["id"] == doc["id"]
    restored = admin.post(path + "/lifecycle", json={"action": "restore", "revision": 3}).json()
    assert restored["can_edit"] and restored["revision"] == 4
    assert [v["revision"] for v in admin.get(path + "/versions").json()] == [4, 3, 2, 1]
    exported = admin.get(path + "/export")
    assert exported.status_code == 200 and doc["title"] in exported.text
    assert "attachment" in exported.headers["content-disposition"]
    assert admin.get("/api/v1/audit/verify").json()["valid"]


def test_guest_cannot_manage_foreign_documents_or_read_task_history(admin):
    doc = admin.post("/api/v1/workspace/documents", json={"title": "Общий"}).json()
    task = admin.post("/api/v1/superapp/tasks", json={"title": "Общая"}).json()
    admin.post("/api/v1/users", json={"username": "private_guest", "password": "test-password-long", "role": "demo"})
    admin.post("/api/v1/auth/logout")
    admin.post("/api/v1/auth/login", json={"username": "private_guest", "password": "test-password-long"})
    assert admin.get(f"/api/v1/superapp/tasks/{task['id']}/history").status_code == 404
    assert admin.get(f"/api/v1/workspace/documents/{doc['id']}/export").status_code == 404
    assert admin.post(f"/api/v1/workspace/documents/{doc['id']}/lifecycle", json={"action": "delete", "revision": 1}).status_code == 404


def test_news_cache_and_stale_data(admin, monkeypatch):
    monkeypatch.setattr(news_module, "cache", {"items": [], "updated_at": None})
    monkeypatch.setattr(news_module, "next_refresh", 0)
    calls = []
    def fetch():
        calls.append(True)
        return [{"title": "Test", "url": "https://cert.europa.eu/test", "published": "", "source": "CERT-EU"}]
    monkeypatch.setattr(news_module, "fetch_feed", fetch)
    first = admin.get("/api/v1/news").json()
    assert first["items"] and not first["stale"] and first["updated_at"]
    assert admin.get("/api/v1/news").json()["updated_at"] == first["updated_at"]
    assert len(calls) == 1
    monkeypatch.setattr(news_module, "next_refresh", 0)
    monkeypatch.setattr(news_module, "fetch_feed", lambda: (_ for _ in ()).throw(OSError()))
    stale = admin.get("/api/v1/news").json()
    assert stale["stale"] and stale["items"] == first["items"]


def test_news_rejects_external_links_and_entity_definitions():
    import pytest
    with pytest.raises(ValueError):
        news_module.parse_feed(b'<!DOCTYPE rss [<!ENTITY test "abc">]><rss/>')
    with pytest.raises(ValueError):
        news_module.parse_feed(b'<rss><channel><item><link>https://evil.example/</link></item></channel></rss>')
