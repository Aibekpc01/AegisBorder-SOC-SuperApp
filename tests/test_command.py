from datetime import timedelta

import pytest

from app.command.models import utcnow
from app.command.scenarios import RULES


@pytest.mark.parametrize("sid", [r[0] for r in RULES])
def test_every_scenario(admin, sid):
    demo = admin.post("/api/v1/demo-sessions").json()
    result = admin.post("/api/v1/scenarios/" + sid, json={"demo_id": demo["id"]})
    assert result.status_code == 200, result.text
    ids = result.json()["incidents"]
    assert ids
    inc = admin.get("/api/v1/incidents/" + str(ids[0])).json()
    assert inc["events"]
    assert inc["explanation"]
    assert 0 < inc["risk"] <= 100
    evidence = admin.get("/api/v1/scenario-runs/" + str(result.json()["run_id"]))
    assert evidence.status_code == 200
    assert len(evidence.json()["events"]) == len(result.json()["events"])
    if sid == "complex":
        assert inc["risk"] == 95
    admin.post(f"/api/v1/demo-sessions/{demo['id']}/reset")
    assert admin.get("/api/v1/dashboard").json()["events"] == 0
    assert admin.get("/api/v1/audit/verify").json()["valid"]


def event(i, time=None, device="ПК-01", kind="login_failed", features=None):
    return {
        "external_id": f"test-{i}",
        "time": (time or utcnow()).isoformat(),
        "device": device,
        "account": "demo_account",
        "source": "test",
        "type": kind,
        "detail": "Учебное событие",
        "features": features or {},
    }


def test_threshold_window_and_idempotence(admin):
    start = utcnow()
    for i in range(4):
        assert (
            admin.post("/api/v1/events", json=event(i, start + timedelta(seconds=i))).status_code
            == 200
        )
    assert admin.get("/api/v1/incidents").json() == []
    payload = event(4, start + timedelta(seconds=4))
    assert admin.post("/api/v1/events", json=payload).status_code == 200
    assert len(admin.get("/api/v1/incidents").json()) == 1
    assert admin.post("/api/v1/events", json=payload).json()["duplicate"]
    assert admin.get("/api/v1/dashboard").json()["events"] == 5
    for i in range(5, 10):
        admin.post(
            "/api/v1/events",
            json=event(i, start + timedelta(seconds=200 + (i - 5) * 70), device="other"),
        )
    assert len(admin.get("/api/v1/incidents").json()) == 1


def test_scopes_and_roles(admin):
    for username in ("demo1", "demo2"):
        assert (
            admin.post(
                "/api/v1/users",
                json={"username": username, "password": "demonstration-password", "role": "demo"},
            ).status_code
            == 200
        )
    admin.post("/api/v1/auth/logout")
    admin.post(
        "/api/v1/auth/login", json={"username": "demo1", "password": "demonstration-password"}
    )
    demo = admin.post("/api/v1/demo-sessions").json()
    result = admin.post("/api/v1/scenarios/bruteforce", json={"demo_id": demo["id"]}).json()
    inc = result["incidents"][0]
    assert admin.post("/api/v1/analytics/reanalyze").status_code == 403
    assert admin.get("/api/v1/users").status_code == 403
    admin.post("/api/v1/auth/logout")
    admin.post(
        "/api/v1/auth/login", json={"username": "demo2", "password": "demonstration-password"}
    )
    assert admin.get(f"/api/v1/incidents/{inc}").status_code == 404
    assert admin.get("/api/v1/scenario-runs/" + str(result["run_id"])).status_code == 404
    assert admin.get("/api/v1/events").json()["total"] == 0
    assert admin.post(f"/api/v1/demo-sessions/{demo['id']}/reset").status_code == 404
    assert (
        admin.post("/api/v1/scenarios/bruteforce", json={"demo_id": demo["id"]}).status_code == 404
    )


def test_investigation_report_lifecycle(admin):
    result = admin.post("/api/v1/scenarios/bruteforce", json={}).json()
    iid = result["incidents"][0]
    assert admin.patch(f"/api/v1/incidents/{iid}", json={"status": "Закрыт"}).status_code == 409
    for status in ["На проверке", "Подтверждён", "Устранён", "Закрыт"]:
        assert admin.patch(f"/api/v1/incidents/{iid}", json={"status": status}).status_code == 200
    assert (
        admin.post(
            f"/api/v1/incidents/{iid}/comments", json={"text": "Проверено оператором"}
        ).status_code
        == 200
    )
    assert (
        admin.put(
            f"/api/v1/incidents/{iid}/investigation",
            json={
                "conclusion": "Учебная проверка завершена",
                "checklist": ["Проверить хронологию событий"],
            },
        ).status_code
        == 200
    )
    report = admin.post(f"/api/v1/reports/{iid}")
    assert report.status_code == 200, report.text
    file = admin.get(f"/api/v1/reports/{report.json()['id']}/pdf")
    assert file.content.startswith(b"%PDF-")
    assert len(file.content) > 5000
    assert (
        admin.get("/api/v1/incidents/" + str(iid)).json()["conclusion"]
        == "Учебная проверка завершена"
    )
    assert admin.get("/api/v1/audit/verify").json()["valid"]


def test_validation_and_observer(admin):
    assert admin.post("/api/v1/events", json={}).status_code == 422
    admin.post(
        "/api/v1/users",
        json={"username": "reader", "password": "reader-password-123", "role": "observer"},
    )
    admin.post("/api/v1/auth/logout")
    admin.post("/api/v1/auth/login", json={"username": "reader", "password": "reader-password-123"})
    assert admin.get("/api/v1/events").status_code == 200
    assert admin.post("/api/v1/scenarios/bruteforce", json={}).status_code == 403


def test_anomaly_model(admin):
    admin.post("/api/v1/scenarios/activity", json={})
    result = admin.post("/api/v1/analytics/anomalies")
    assert result.status_code == 200
    assert result.json()["version"] == "isolation-forest-synthetic-v1"
    assert result.json()["parameters"]["random_state"] == 42
    assert any(r["anomaly"] for r in result.json()["results"])


def test_logout_revokes_jwt(admin):
    cookie = admin.cookies.get("aegis_session")
    assert admin.post("/api/v1/auth/logout").status_code == 200
    assert (
        admin.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + cookie}).status_code
        == 401
    )


def test_bad_origin_rejected(admin):
    assert (
        admin.post("/api/v1/demo-sessions", headers={"Origin": "https://evil.example"}).status_code
        == 403
    )


def test_user_password_role_management(admin):
    row = admin.post(
        "/api/v1/users",
        json={"username": "managed", "password": "initial-password-123", "role": "analyst"},
    ).json()
    updated = admin.patch(
        "/api/v1/users/" + str(row["id"]),
        json={"role": "observer", "password": "changed-password-123"},
    )
    assert updated.status_code == 200
    assert updated.json()["role"] == "observer"
    admin.post("/api/v1/auth/logout")
    assert (
        admin.post(
            "/api/v1/auth/login", json={"username": "managed", "password": "initial-password-123"}
        ).status_code
        == 401
    )
    assert (
        admin.post(
            "/api/v1/auth/login", json={"username": "managed", "password": "changed-password-123"}
        ).status_code
        == 200
    )
    assert admin.post("/api/v1/scenarios/usb", json={}).status_code == 403


def test_websocket_authenticated(admin):
    with admin.websocket_connect("/api/v1/ws") as ws:
        data = ws.receive_json()
        assert "event_revision" in data and "incidents" in data


def test_rule_settings_and_event_link(admin):
    run = admin.post("/api/v1/scenarios/usb", json={}).json()
    iid = run["incidents"][0]
    event = admin.post(
        "/api/v1/events",
        json={
            "external_id": "link-event",
            "time": utcnow().isoformat(),
            "device": "ПК-01",
            "account": "test",
            "source": "test",
            "type": "info",
            "detail": "Дополнительное доказательство",
            "features": {},
        },
    ).json()["event"]
    assert admin.post(f"/api/v1/incidents/{iid}/events/{event['id']}").status_code == 200
    assert len(admin.get(f"/api/v1/incidents/{iid}").json()["events"]) == 2
    assert (
        admin.put(
            "/api/v1/settings", json={"organization": "Учебная комиссия", "simple_mode": False}
        ).status_code
        == 200
    )
    assert admin.get("/api/v1/settings").json()["simple_mode"] is False
