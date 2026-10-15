"""Smoke-test a disposable ULTRA container, never the production URL."""
import http.cookiejar
import json
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8012"
credentials = dotenv_values(ROOT / ".env.ultra-preview")
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
checks = []


def request(path, data=None, method=None, expected=200):
    req = urllib.request.Request(
        BASE + path,
        data=None if data is None else json.dumps(data).encode(),
        method=method,
        headers={"Content-Type": "application/json", "Origin": BASE},
    )
    try:
        with client.open(req, timeout=30) as response:
            status = response.status
            body = response.read()
    except urllib.error.HTTPError as error:
        status = error.code
        body = error.read()
    assert status == expected, (path, status)
    checks.append({"path": path, "status": status})
    return body


request("/api/v1/health")
request("/")
request("/app")
request("/api/v1/auth/login", {"username": "admin", "password": credentials["ADMIN_PASSWORD"]})
assert json.loads(request("/api/v1/auth/me"))["role"] == "admin"
request("/api/v1/auth/logout", {})
assert json.loads(request("/api/v1/auth/demo-viewer", {}))["role"] == "demo_viewer"
request("/api/v1/settings", {"organization": "must not change"}, method="PUT", expected=403)
session = json.loads(request("/api/v1/demo-sessions", {}))
request("/api/v1/scenarios/usb", {"demo_id": session["id"]})
request("/api/v1/auth/logout", {})
(ROOT / "release/aegis-ultra/docker-arm64-runtime.json").write_text(
    json.dumps({"checks": checks}, indent=2), encoding="utf-8"
)
print(f"PASS: {len(checks)} runtime checks on disposable ARM64 container")
