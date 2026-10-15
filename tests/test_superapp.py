import json

from app.command.models import utcnow

BASE = "/api/v1/superapp"


def event(external_id="suite-1"):
    return {
        "external_id": external_id,
        "time": utcnow().isoformat(),
        "device": "TRAINING-PC",
        "account": "training-user",
        "source": "Synthetic",
        "type": "usb_connected",
        "detail": "Учебное подключение USB",
        "features": {"approved": False},
    }


def login(client, username):
    client.post("/api/v1/auth/logout")
    response = client.post(
        "/api/v1/auth/login", json={"username": username, "password": "test-password-long"}
    )
    assert response.status_code == 200, response.text


def account(admin, name, role):
    response = admin.post(
        "/api/v1/users", json={"username": name, "password": "test-password-long", "role": role}
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_import_preview_atomic_validation_and_deduplication(admin):
    payload = {"format": "json", "content": json.dumps([event()])}
    assert admin.post(BASE + "/imports/preview", json=payload).json()["count"] == 1
    assert admin.get("/api/v1/dashboard").json()["events"] == 0
    response = admin.post(BASE + "/imports", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["payload"]["created"] == 1
    assert response.json()["payload"]["incidents"]
    assert admin.post(BASE + "/imports", json=payload).json()["payload"]["duplicates"] == 1
    invalid = {**event("bad"), "time": "2026-01-01T12:00:00"}
    assert (
        admin.post(
            BASE + "/imports", json={"content": json.dumps([event("new"), invalid])}
        ).status_code
        == 422
    )
    assert admin.get("/api/v1/dashboard").json()["events"] == 1
    assert len(admin.get(BASE + "/history/import").json()) == 2
    assert admin.get("/api/v1/audit/verify").json()["valid"]


def test_task_transitions_conflicts_and_demo_isolation(admin):
    account(admin, "demo_a", "demo")
    account(admin, "demo_b", "demo")
    login(admin, "demo_a")
    task = admin.post(BASE + "/tasks", json={"title": "Проверить USB"}).json()
    assert task["private"]
    assert (
        admin.patch(
            f"{BASE}/tasks/{task['id']}", json={"revision": 1, "status": "Завершена"}
        ).status_code
        == 409
    )
    response = admin.patch(f"{BASE}/tasks/{task['id']}", json={"revision": 1, "status": "В работе"})
    assert response.status_code == 200, response.text
    assert response.json()["revision"] == 2
    assert (
        admin.patch(
            f"{BASE}/tasks/{task['id']}", json={"revision": 1, "status": "На проверке"}
        ).status_code
        == 409
    )
    login(admin, "demo_b")
    assert admin.get(BASE + "/tasks").json() == []
    assert (
        admin.patch(
            f"{BASE}/tasks/{task['id']}", json={"revision": 2, "status": "На проверке"}
        ).status_code
        == 404
    )
    assert admin.post(BASE + "/imports", json={"content": json.dumps([event()])}).status_code == 403


def test_mail_negative_case_and_personal_history(admin):
    account(admin, "mail_demo", "demo")
    result = admin.post(
        BASE + "/mail/analyze",
        json={
            "sender": "training@example.test",
            "subject": "Срочно: пароль",
            "body": "Введите пароль: https://127.0.0.1/login",
            "attachments": ["update.exe"],
        },
    )
    assert result.status_code == 201, result.text
    assert result.json()["payload"]["score"] == 100
    clean = admin.post(
        BASE + "/mail/analyze",
        json={
            "sender": "training@example.test",
            "subject": "План занятий",
            "body": "Встреча в среду",
            "attachments": ["schedule.pdf"],
        },
    ).json()["payload"]
    assert clean["score"] == 0
    assert "гарант" not in clean["verdict"]
    login(admin, "mail_demo")
    assert admin.get(BASE + "/history/mail").json() == []


def test_academy_server_grading_and_observer_permissions(admin):
    account(admin, "observer_suite", "observer")
    login(admin, "observer_suite")
    courses = admin.get(BASE + "/academy").json()
    assert "answer" not in courses[0]["questions"][0]
    assert (
        admin.post(BASE + "/academy/phishing", json={"answers": [0, 0]}).json()["payload"]["score"]
        == 0
    )
    assert admin.post(BASE + "/academy/phishing", json={"answers": [1, 1]}).json()["payload"][
        "passed"
    ]
    assert admin.post(BASE + "/academy/phishing", json={"answers": [1]}).status_code == 422
    assert admin.post(BASE + "/academy/phishing", json={"answers": [-1, 1]}).status_code == 422
    assert admin.post(BASE + "/tasks", json={"title": "Запрещено"}).status_code == 403
    assert (
        admin.post(
            BASE + "/rules",
            json={
                "name": "x",
                "event_type": "custom",
                "threshold": 1,
                "window": 60,
                "risk": 20,
                "description": "x",
            },
        ).status_code
        == 403
    )


def test_builder_real_detection_twin_assistant_and_reset(admin):
    account(admin, "builder_demo", "demo")
    login(admin, "builder_demo")
    saved = admin.post(
        BASE + "/scenarios", json={"title": "USB-проверка", "events": [event()]}
    ).json()
    run = admin.post(f"{BASE}/scenarios/{saved['id']}/run", json={})
    assert run.status_code == 201, run.text
    run = run.json()
    assert run["events"] == 1 and run["incidents"]
    twin = admin.get(BASE + "/twin").json()
    assert twin["nodes"][0]["name"] == "TRAINING-PC"
    assert twin["nodes"][0]["risk"] > 0
    incident_id = run["incidents"][0]
    draft = admin.get(f"{BASE}/assistant/{incident_id}").json()
    assert draft["evidence_ids"] and draft["requires_review"]
    task = admin.post(
        BASE + "/tasks", json={"title": "Проверка", "incident_id": incident_id}
    ).json()
    assert admin.post(f"/api/v1/demo-sessions/{run['demo_id']}/reset").status_code == 200
    assert admin.get(BASE + "/tasks").json()[0]["id"] == task["id"]
    assert admin.get(BASE + "/tasks").json()[0]["incident_id"] is None
    assert admin.get(BASE + "/twin").json()["nodes"] == []


def test_custom_rule_applies_to_new_events(admin):
    rule = admin.post(
        BASE + "/rules",
        json={
            "name": "Custom training rule",
            "event_type": "custom_training",
            "threshold": 1,
            "window": 60,
            "risk": 40,
            "description": "Одно учебное событие",
        },
    )
    assert rule.status_code == 201, rule.text
    data = {**event(), "type": "custom_training"}
    imported = admin.post(BASE + "/imports", json={"content": json.dumps([data])})
    assert imported.status_code == 201, imported.text
    inc = admin.get("/api/v1/incidents").json()[0]
    assert inc["rule_id"] == rule.json()["id"]


def test_m365_imported_monitor_and_bounded_scenario(admin):
    data = {**event(), "source": "Microsoft 365"}
    assert admin.post(BASE + "/imports", json={"content": json.dumps([data])}).status_code == 201
    monitor = admin.get(BASE + "/m365").json()
    assert not monitor["connected"]
    assert monitor["accounts"] == monitor["devices"] == 1
    assert monitor["events"][0]["source"] == "Microsoft 365"
    assert (
        admin.post(
            BASE + "/scenarios",
            json={
                "title": "Invalid",
                "events": [event("a"), {**event("b"), "time": "2099-01-01T00:00:00Z"}],
            },
        ).status_code
        == 422
    )
    assert (
        admin.post(
            BASE + "/scenarios",
            json={"title": "Invalid", "events": [{**event(), "execute": "anything"}]},
        ).status_code
        == 422
    )


def test_import_foreign_duplicate_rolls_back_entire_batch(admin):
    payload = {"content": json.dumps([event("shared-external")])}
    assert admin.post(BASE + "/imports", json=payload).status_code == 201
    account(admin, "import_analyst", "analyst")
    login(admin, "import_analyst")
    response = admin.post(
        BASE + "/imports",
        json={"content": json.dumps([event("new-before-conflict"), event("shared-external")])},
    )
    assert response.status_code == 409
    assert admin.get("/api/v1/dashboard").json()["events"] == 1
    assert admin.get(BASE + "/history/import").json() == []
