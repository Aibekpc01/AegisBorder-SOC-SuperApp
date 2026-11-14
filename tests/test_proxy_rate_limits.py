"""Trusted proxy forwarding must not collapse every visitor into one rate bucket."""
from fastapi.testclient import TestClient

from app.command import api as module


def test_independent_forwarded_clients_have_separate_write_quotas(client, monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_CIDRS", "10.88.7.10/32")
    with TestClient(module.app, client=("10.88.7.10", 50000)) as proxy:
        first = {"X-Forwarded-For": "203.0.113.10"}
        second = {"X-Forwarded-For": "203.0.113.11"}
        for _ in range(120):
            assert proxy.post("/api/v1/health", headers=first).status_code == 405
        assert proxy.post("/api/v1/health", headers=first).status_code == 429
        assert proxy.post("/api/v1/health", headers=second).status_code == 405


def test_untrusted_forwarding_cannot_reset_write_quota(client, monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_CIDRS", "10.88.7.10/32")
    with TestClient(module.app, client=("10.88.7.11", 50000)) as untrusted:
        for number in range(120):
            assert untrusted.post("/api/v1/health", headers={"X-Forwarded-For": f"203.0.113.{number + 1}"}).status_code == 405
        assert untrusted.post("/api/v1/health", headers={"X-Forwarded-For": "198.51.100.1"}).status_code == 429


def test_login_limit_uses_verified_forwarded_client_address(client, monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_CIDRS", "10.88.7.10/32")
    with TestClient(module.app, client=("10.88.7.10", 50000)) as proxy:
        data = {"username": "nonexistent_rate_audit", "password": "invalid-test-password"}
        first = {"X-Forwarded-For": "203.0.113.10"}
        second = {"X-Forwarded-For": "203.0.113.11"}
        for _ in range(10):
            assert proxy.post("/api/v1/auth/login", headers=first, json=data).status_code == 401
        assert proxy.post("/api/v1/auth/login", headers=first, json=data).status_code == 429
        assert proxy.post("/api/v1/auth/login", headers=second, json=data).status_code == 401
