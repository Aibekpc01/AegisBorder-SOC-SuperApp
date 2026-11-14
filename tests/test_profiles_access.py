# Назначение файла: Проверяет подсистему profiles_access. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import base64
import os
from datetime import timedelta
from io import BytesIO

from fastapi import Request
from fastapi.testclient import TestClient
from PIL import Image, PngImagePlugin
from sqlalchemy import select

from app.command import api as module
from app.command.access import DEFAULT_POLICY, connection, evaluate
from app.command.models import LoginRecord, utcnow


def test_profile_avatar_and_metadata(admin):
    uid = admin.get("/api/v1/auth/me").json()["id"]
    profile = {
        "full_name": "Учебный оператор",
        "department": "Учебный отдел",
        "position": "Аналитик",
        "email": "demo@example.invalid",
        "phone": "+7 (000) 000-00-00",
        "bio": "Синтетическая карточка",
    }
    assert admin.put(f"/api/v1/users/{uid}/profile", json=profile).status_code == 200
    assert (
        admin.get(f"/api/v1/users/{uid}/profile").json()["profile"]["full_name"]
        == "Учебный оператор"
    )
    image = Image.new("RGB", (800, 600), "blue")
    stream = BytesIO()
    meta = PngImagePlugin.PngInfo()
    meta.add_text("SecretMetadata", "must-be-removed")
    image.save(stream, format="PNG", pnginfo=meta)
    response = admin.put(
        f"/api/v1/users/{uid}/avatar",
        json={
            "image_data_url": "data:image/png;base64,"
            + base64.b64encode(stream.getvalue()).decode()
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["profile"]["has_avatar"]
    assert "avatar_data" not in response.json()["profile"]
    picture = admin.get(f"/api/v1/users/{uid}/avatar")
    assert picture.headers["content-type"] == "image/png"
    with Image.open(BytesIO(picture.content)) as decoded:
        assert max(decoded.size) <= 512
        assert "SecretMetadata" not in decoded.info
    assert admin.delete(f"/api/v1/users/{uid}/avatar").status_code == 200
    assert admin.get(f"/api/v1/users/{uid}/avatar").status_code == 404


def test_avatar_validation(admin):
    uid = admin.get("/api/v1/auth/me").json()["id"]
    for value in ("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "data:image/png;base64,not-valid"):
        assert (
            admin.put(f"/api/v1/users/{uid}/avatar", json={"image_data_url": value}).status_code
            == 422
        )
    oversized = base64.b64encode(b"x" * (2 * 1024 * 1024 + 1)).decode()
    assert (
        admin.put(
            f"/api/v1/users/{uid}/avatar",
            json={"image_data_url": "data:image/png;base64," + oversized},
        ).status_code
        == 413
    )


def test_private_profile_permissions(admin):
    other = admin.post(
        "/api/v1/users",
        json={"username": "profile_reader", "password": "reader-password-123", "role": "observer"},
    ).json()
    admin.post("/api/v1/auth/logout")
    admin.post(
        "/api/v1/auth/login", json={"username": "profile_reader", "password": "reader-password-123"}
    )
    assert admin.get("/api/v1/users/1/profile").status_code == 404
    assert admin.get("/api/v1/users/1/logins").status_code == 404
    assert admin.get("/api/v1/users/1/avatar").status_code == 404
    assert (
        admin.put(
            f"/api/v1/users/{other['id']}/profile", json={"full_name": "Учебный наблюдатель"}
        ).status_code
        == 200
    )
    assert (
        admin.put(f"/api/v1/users/{other['id']}/profile", json={"role": "admin"}).status_code == 422
    )
    assert admin.get("/api/v1/access-policy").status_code == 403


def test_location_is_opt_in_and_history_persists(admin):
    uid = admin.get("/api/v1/auth/me").json()["id"]
    assert admin.get("/api/v1/auth/me").json()["last_location"] is None
    payload = {
        "latitude": 51.1,
        "longitude": 71.4,
        "accuracy": 125,
        "observed_at": utcnow().isoformat(),
    }
    assert admin.post("/api/v1/auth/location", json=payload).status_code == 200
    assert admin.get("/api/v1/auth/me").json()["last_location"]["accuracy"] == 125
    assert admin.post("/api/v1/auth/location", json={**payload, "latitude": 91}).status_code == 422
    assert (
        admin.post(
            "/api/v1/auth/location",
            json={**payload, "observed_at": (utcnow() - timedelta(hours=1)).isoformat()},
        ).status_code
        == 422
    )
    admin.post("/api/v1/auth/logout")
    admin.post(
        "/api/v1/auth/login", json={"username": "admin", "password": os.environ["ADMIN_PASSWORD"]}
    )
    history = admin.get(f"/api/v1/users/{uid}/logins").json()
    assert history[0]["location"] is None
    assert admin.get("/api/v1/auth/me").json()["last_location"]["latitude"] == 51.1


def test_network_rules_and_real_login_blocking(admin):
    config = {
        **DEFAULT_POLICY,
        "networks": [
            {
                "cidr": "203.0.113.0/24",
                "kind": "vpn",
                "label": "Учебный диапазон VPN",
                "country": "",
                "city": "",
            }
        ],
    }
    assert admin.put("/api/v1/access-policy", json=config).status_code == 200
    assert not admin.post("/api/v1/access-policy/check", json={"ip": "203.0.113.9"}).json()[
        "allowed"
    ]
    remote = TestClient(module.app, client=("203.0.113.9", 54321))
    response = remote.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": os.environ["ADMIN_PASSWORD"]},
        headers={"X-Forwarded-For": "127.0.0.1"},
    )
    assert response.status_code == 403
    history = admin.get("/api/v1/users/1/logins").json()
    assert history[0]["ip"] == "203.0.113.9" and history[0]["success"] is False
    assert history[0]["network"]["network_kind"] == "vpn"


def test_untrusted_and_trusted_forwarding(monkeypatch):
    request = Request(
        {
            "type": "http",
            "client": ("10.0.0.1", 99),
            "headers": [(b"x-forwarded-for", b"203.0.113.10")],
        }
    )
    monkeypatch.delenv("TRUSTED_PROXY_CIDRS", raising=False)
    assert connection(request)["ip"] == "10.0.0.1"
    monkeypatch.setenv("TRUSTED_PROXY_CIDRS", "10.0.0.0/24")
    assert connection(request)["ip"] == "203.0.113.10"
    assert evaluate("198.51.100.5", DEFAULT_POLICY)["city"] == ""


def test_unknown_vpn_is_not_claimed_safe():
    result = evaluate("198.51.100.5", DEFAULT_POLICY)
    assert result["anonymizer_status"].startswith("Не установлено")
    strict = {**DEFAULT_POLICY, "restrict_to_trusted": True, "trusted_cidrs": ["192.168.10.0/24"]}
    assert evaluate("192.168.10.5", strict)["allowed"]
    assert not evaluate("192.168.11.5", strict)["allowed"]


def test_unknown_login_recorded(client):
    assert (
        client.post(
            "/api/v1/auth/login", json={"username": "unknown", "password": "wrong"}
        ).status_code
        == 401
    )
    with client.factory() as db:
        row = db.scalar(select(LoginRecord).where(LoginRecord.username == "unknown"))
        assert row and row.user_id is None and row.success is False


def test_policy_input_validation_and_lockout_prevention(admin):
    assert (
        admin.put(
            "/api/v1/access-policy", json={**DEFAULT_POLICY, "blocked_cidrs": ["not-an-ip"]}
        ).status_code
        == 422
    )
    assert (
        admin.put(
            "/api/v1/access-policy", json={**DEFAULT_POLICY, "restrict_to_trusted": True}
        ).status_code
        == 422
    )
    restrictive = {**DEFAULT_POLICY, "restrict_to_trusted": True, "trusted_cidrs": ["192.0.2.0/24"]}
    assert admin.put("/api/v1/access-policy", json=restrictive).status_code == 422
    assert not admin.get("/api/v1/access-policy").json()["restrict_to_trusted"]


def test_existing_session_blocked_but_logout_allowed(admin):
    remote = TestClient(module.app, client=("203.0.113.25", 50000))
    assert (
        remote.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": os.environ["ADMIN_PASSWORD"]},
        ).status_code
        == 200
    )
    assert remote.get("/api/v1/events").status_code == 200
    assert (
        admin.put(
            "/api/v1/access-policy", json={**DEFAULT_POLICY, "blocked_cidrs": ["203.0.113.0/24"]}
        ).status_code
        == 200
    )
    assert remote.get("/api/v1/events").status_code == 403
    assert remote.post("/api/v1/auth/logout").status_code == 200
    assert remote.get("/api/v1/auth/me").status_code == 401
