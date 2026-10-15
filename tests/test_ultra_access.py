"""Server permissions and reversible administration for AEGIS ULTRA."""


def viewer(client, admin):
    response = admin.post("/api/v1/users", json={
        "username": "presentation_viewer", "password": "Viewer-password-123!", "role": "demo_viewer",
    })
    assert response.status_code == 200
    client.post("/api/v1/auth/logout")
    response = client.post("/api/v1/auth/login", json={
        "username": "presentation_viewer", "password": "Viewer-password-123!",
    })
    assert response.status_code == 200
    return client


def test_viewer_isolated_scenarios_and_default_deny(client, admin):
    # A global incident must never leak into the viewer's scheme or list.
    assert admin.post("/api/v1/scenarios/usb", json={}).status_code == 200
    c = viewer(client, admin)
    assert c.get("/api/v1/incidents").json() == []
    assert c.get("/api/v1/superapp/twin").json()["nodes"] == []
    assert c.get("/api/v1/dashboard").json()["assets"] == 0
    for method, path, data in [
        ("put", "/api/v1/settings", {"organization": "unauthorized"}),
        ("post", "/api/v1/users", {"username": "intruder", "password": "intruder-password-123", "role": "admin"}),
        ("post", "/api/v1/superapp/tasks", {"title": "unauthorized"}),
        ("post", "/api/v1/superapp/tasks/manage", {"action": "delete", "items": [{"id": 1, "revision": 1}]}),
        ("post", "/api/v1/superapp/imports/preview", {"format": "json", "content": "[]"}),
        ("post", "/api/v1/demo-sessions/1/reset", {}),
    ]:
        assert getattr(c, method)(path, json=data).status_code == 403, path
    assert c.post("/api/v1/scenarios/usb", json={}).status_code == 422
    session = c.post("/api/v1/demo-sessions", json={}).json()
    run = c.post("/api/v1/scenarios/usb", json={"demo_id": session["id"]})
    assert run.status_code == 200
    assert run.json()["incidents"]
    incident = run.json()["incidents"][0]
    assert c.get(f"/api/v1/incidents/{incident}").status_code == 200
    assert c.post(f"/api/v1/reports/{incident}", json={}).status_code == 200
    assert c.post("/api/v1/auth/logout").status_code == 200


def test_public_viewer_role(client, monkeypatch):
    monkeypatch.setenv("PUBLIC_DEMO_MODE", "true")
    r = client.post("/api/v1/auth/demo-viewer")
    assert r.status_code == 200
    assert r.json()["role"] == "demo_viewer"
    assert client.get("/api/v1/users").status_code == 403
    assert client.put("/api/v1/settings", json={"organization": "not allowed"}).status_code == 403


def test_task_archive_restore_and_conflicting_bulk_is_atomic(admin):
    a = admin.post("/api/v1/superapp/tasks", json={"title": "First task"}).json()
    b = admin.post("/api/v1/superapp/tasks", json={"title": "Second task"}).json()
    manage = "/api/v1/superapp/tasks/manage"
    bad = admin.post(manage, json={"action": "archive", "items": [
        {"id": a["id"], "revision": a["revision"]}, {"id": b["id"], "revision": 999},
    ]})
    assert bad.status_code == 409
    assert len(admin.get("/api/v1/superapp/tasks").json()) == 2
    assert admin.post(manage, json={"action": "archive", "items": [
        {"id": a["id"], "revision": a["revision"]}, {"id": b["id"], "revision": b["revision"]},
    ]}).status_code == 200
    assert admin.get("/api/v1/superapp/tasks").json() == []
    archived = admin.get("/api/v1/superapp/tasks?state=archived").json()
    assert len(archived) == 2
    assert admin.post(manage, json={"action": "delete", "items": [
        {"id": a["id"], "revision": 2},
    ]}).status_code == 200
    deleted = admin.get("/api/v1/superapp/tasks?state=deleted").json()
    assert deleted[0]["title"] == "First task"
    assert admin.post(manage, json={"action": "restore", "items": [
        {"id": a["id"], "revision": 3},
    ]}).status_code == 200
    restored = admin.get("/api/v1/superapp/tasks").json()[0]
    assert restored["revision"] == 4
    assert admin.get("/api/v1/audit/verify").json()["valid"] is True


def test_incident_task_evidence_cannot_be_deleted(admin):
    run = admin.post("/api/v1/scenarios/usb", json={}).json()
    task = admin.post("/api/v1/superapp/tasks", json={"title": "Evidence review", "incident_id": run["incidents"][0]}).json()
    assert admin.post("/api/v1/superapp/tasks/manage", json={"action": "delete", "items": [
        {"id": task["id"], "revision": task["revision"]},
    ]}).status_code == 409
