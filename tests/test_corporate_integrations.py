import json

import pytest

from app.command.location import city_label
from app.command.models import utcnow

BASE = "/api/v1/integrations"


def create(admin, provider="generic"):
    response = admin.post(
        BASE + "/connectors", json={"name": "Учебный приёмник", "provider": provider}
    )
    assert response.status_code == 201, response.text
    return response.json()


def data():
    return {
        "external_id": "one",
        "time": utcnow().isoformat(),
        "device": "TRAINING-PC",
        "account": "user",
        "source": "Synthetic",
        "type": "usb_connected",
        "detail": "Учебное событие",
        "features": {"approved": False},
    }


def test_receiver_auth_deduplication_rotation_and_disable(admin):
    c = create(admin)
    path = c["endpoint"]
    headers = {"Authorization": "Bearer " + c["token"]}
    listing = admin.get(BASE + "/connectors").json()
    assert "token" not in listing[0] and "token_hash" not in listing[0]
    assert admin.post(path, json=[data()]).status_code == 401
    assert admin.post(path.replace("events", "check"), headers=headers).json()["ok"]
    assert admin.get("/api/v1/dashboard").json()["events"] == 0
    response = admin.post(path, json=[data()], headers=headers)
    assert response.status_code == 201, response.text
    assert response.json()["created"] == 1
    assert response.json()["incidents"]
    assert admin.post(path, json=[data()], headers=headers).json()["duplicates"] == 1
    listing = admin.get(BASE + "/connectors").json()[0]
    assert listing["received"] == 1 and listing["received_at"]
    new = admin.post(BASE + f"/connectors/{c['id']}/rotate").json()
    assert admin.post(path, json=[data()], headers=headers).status_code == 401
    headers = {"Authorization": "Bearer " + new["token"]}
    assert admin.patch(BASE + f"/connectors/{c['id']}", json={"enabled": False}).status_code == 200
    assert admin.post(path, json=[data()], headers=headers).status_code == 403
    assert admin.get("/api/v1/audit/verify").json()["valid"]


@pytest.mark.parametrize(
    "provider,raw,source",
    [
        (
            "kaspersky",
            {"id": "av1", "host": "PC", "user": "user", "event": "malware_detected"},
            "Kaspersky",
        ),
        (
            "dlp",
            {"event_id": "dlp1", "workstation": "PC", "user": "user", "action": "file_copy"},
            "DLP",
        ),
        (
            "m365",
            {
                "id": "office1",
                "initiatedBy": {"user": {"userPrincipalName": "user@example.test"}},
                "activityDisplayName": "Add user",
            },
            "Microsoft 365",
        ),
    ],
)
def test_vendor_normalization(admin, provider, raw, source):
    c = create(admin, provider)
    raw["activityDateTime" if provider == "m365" else "timestamp"] = utcnow().isoformat()
    response = admin.post(
        c["endpoint"], json=[raw], headers={"Authorization": "Bearer " + c["token"]}
    )
    assert response.status_code == 201, response.text
    assert admin.get("/api/v1/events").json()["items"][0]["source"] == source
    if provider == "m365":
        assert len(admin.get("/api/v1/superapp/m365").json()["events"]) == 1


def test_receiver_atomicity_namespacing_and_limits(admin):
    c = create(admin)
    h = {"Authorization": "Bearer " + c["token"]}
    invalid = {**data(), "time": "2026-01-01T00:00:00"}
    assert admin.post(c["endpoint"], json=[data(), invalid], headers=h).status_code == 422
    assert admin.get("/api/v1/dashboard").json()["events"] == 0
    assert admin.post(c["endpoint"], json=[data()] * 201, headers=h).status_code == 422
    assert admin.post(c["endpoint"], content="x" * 200001, headers=h).status_code == 413
    assert admin.post(c["endpoint"], json=[data()], headers=h).status_code == 201
    second = create(admin)
    assert (
        admin.post(
            second["endpoint"],
            json=[data()],
            headers={"Authorization": "Bearer " + second["token"]},
        ).json()["created"]
        == 1
    )


def test_connector_rbac_and_inactive_owner(admin):
    c = create(admin)
    response = admin.post(
        "/api/v1/users",
        json={"username": "observer2", "password": "test-password-long", "role": "observer"},
    )
    assert response.status_code == 200
    admin.post("/api/v1/auth/logout")
    admin.post(
        "/api/v1/auth/login", json={"username": "observer2", "password": "test-password-long"}
    )
    assert (
        admin.post(BASE + "/connectors", json={"name": "Denied", "provider": "generic"}).status_code
        == 403
    )
    assert admin.post(BASE + f"/connectors/{c['id']}/rotate").status_code == 403
    assert "token_hash" not in json.dumps(admin.get(BASE + "/connectors").json())


def test_city_labels_are_approximate_and_do_not_invent_unknown_city():
    assert city_label(43.2389, 76.8897, 100)["city"] == "Алматы"
    assert city_label(51.1694, 71.4491, 100)["city"] == "Астана"
    assert city_label(0, 0, 1)["city"] == ""
    assert city_label(43.2389, 76.8897, 50000)["city"] == ""


def test_public_demo_disabled_by_default_and_scoped(client, monkeypatch):
    assert client.post("/api/v1/auth/demo").status_code == 404
    monkeypatch.setenv("PUBLIC_DEMO_MODE", "true")
    monkeypatch.setenv("PUBLIC_ORIGIN", "https://demo.example.test")
    first = client.post("/api/v1/auth/demo", headers={"Origin": "https://demo.example.test"})
    assert first.status_code == 200, first.text
    assert first.json()["role"] == "demo"
    assert "Secure" in first.headers["set-cookie"] and "HttpOnly" in first.headers["set-cookie"]
    # Secure cookie is unavailable over the test client's HTTP origin; pass token explicitly.
    token = client.cookies.get("aegis_session")
    assert (
        client.get(BASE + "/connectors", headers={"Authorization": "Bearer " + token}).json() == []
    )
    assert (
        client.post(
            BASE + "/connectors",
            json={"name": "Denied", "provider": "generic"},
            headers={"Authorization": "Bearer " + token},
        ).status_code
        == 403
    )
    second = client.post("/api/v1/auth/demo")
    assert second.json()["id"] != first.json()["id"]
    assert (
        client.post("/api/v1/auth/demo", headers={"Origin": "https://attacker.test"}).status_code
        == 403
    )
