# Назначение файла: Проверяет подсистему detection_boundaries. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

from datetime import timedelta

import pytest

from app.command.models import utcnow


@pytest.mark.parametrize(
    "success_second,denied_second,expected_risk", [(15, 50, 65), (45, 5, 80), (45, 50, 95)]
)
def test_escalation_requires_chronological_chain(
    admin, success_second, denied_second, expected_risk
):
    start = utcnow()
    events = [(second, "login_failed", {}) for second in (0, 10, 20, 30, 40)]
    events += [
        (success_second, "login_success", {"local_hour": 12}),
        (denied_second, "file_denied", {"restricted": True}),
    ]
    for index, (second, kind, features) in enumerate(sorted(events)):
        response = admin.post(
            "/api/v1/events",
            json={
                "external_id": f"ordered-{index}",
                "time": (start + timedelta(seconds=second)).isoformat(),
                "device": "chronology",
                "account": "synthetic",
                "source": "test",
                "type": kind,
                "detail": "Учебная проверка порядка",
                "features": features,
            },
        )
        assert response.status_code == 200, response.text
    incident = next(
        i for i in admin.get("/api/v1/incidents").json() if i["rule_id"] == "bruteforce"
    )
    assert incident["risk"] == expected_risk
    detail = admin.get(f"/api/v1/incidents/{incident['id']}").json()
    assert len(detail["events"]) == {65: 5, 80: 6, 95: 7}[expected_risk]


@pytest.mark.parametrize(
    "kind,features,count",
    [
        ("login_success", {"local_hour": 12}, 1),
        ("file_denied", {"restricted": False}, 1),
        ("usb_connected", {"approved": True}, 1),
        ("heartbeat_lost", {"kind": "server", "gap_seconds": 119}, 1),
        ("activity", {"cpu": 89, "processes": 100}, 1),
        ("activity", {"cpu": 95, "processes": 49}, 1),
        ("file_changed", {"critical": False}, 1),
        ("file_copy", {"files": 100}, 3),
        ("network", {"approved": True}, 3),
        ("role_changed", {"new_role": "admin", "approved": True}, 1),
        ("policy_violation", {}, 2),
        ("account_action", {"unusual": True, "volume": 499, "baseline": 100}, 1),
        ("config_changed", {"protection_enabled": True, "approved": False}, 1),
    ],
)
def test_no_false_alarm_under_threshold(admin, kind, features, count):
    for index in range(count):
        r = admin.post(
            "/api/v1/events",
            json={
                "external_id": f"negative-{index}",
                "time": utcnow().isoformat(),
                "device": "test",
                "account": "test",
                "source": "test",
                "type": kind,
                "detail": "Нормальное учебное событие",
                "features": features,
            },
        )
        assert r.status_code == 200, r.text
    assert admin.get("/api/v1/incidents").json() == []


def test_reanalyze_keeps_closed_incident(admin):
    result = admin.post("/api/v1/scenarios/bruteforce", json={}).json()
    count = len(admin.get("/api/v1/incidents").json())
    iid = result["incidents"][0]
    for status in ["На проверке", "Подтверждён", "Устранён", "Закрыт"]:
        assert admin.patch(f"/api/v1/incidents/{iid}", json={"status": status}).status_code == 200
    assert admin.post("/api/v1/analytics/reanalyze").status_code == 200
    assert len(admin.get("/api/v1/incidents").json()) == count


def test_feature_types_rejected(admin):
    response = admin.post(
        "/api/v1/events",
        json={
            "external_id": "invalid",
            "time": utcnow().isoformat(),
            "device": "test",
            "account": "test",
            "source": "test",
            "type": "activity",
            "detail": "test",
            "features": {"cpu": "ninety"},
        },
    )
    assert response.status_code == 422


def test_changed_rule_and_rate_limit(admin):
    assert (
        admin.patch(
            "/api/v1/detection-rules/bruteforce",
            json={"enabled": False, "threshold": 5, "window": 60, "risk": 65},
        ).status_code
        == 200
    )
    result = admin.post("/api/v1/scenarios/bruteforce", json={})
    assert result.status_code == 200
    assert all(i["rule_id"] != "bruteforce" for i in admin.get("/api/v1/incidents").json())
    for _ in range(9):
        admin.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert (
        admin.post(
            "/api/v1/auth/login", json={"username": "admin", "password": "wrong"}
        ).status_code
        == 429
    )
