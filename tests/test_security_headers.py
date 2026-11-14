# Назначение файла: Проверяет заголовки безопасности и кэширования (app/command/headers.py).
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

from app.command.headers import CONTENT_SECURITY_POLICY, IMMUTABLE_ASSETS, security_headers


def test_api_response_has_strict_policy(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Content-Security-Policy"] == CONTENT_SECURITY_POLICY
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "geolocation=(self)" in response.headers["Permissions-Policy"]
    # Тестовый клиент работает по HTTP — HSTS отправлять нельзя.
    assert "Strict-Transport-Security" not in response.headers


def test_csp_allows_only_own_origin():
    directives = dict(part.split(" ", 1) for part in CONTENT_SECURITY_POLICY.split("; "))
    assert directives["script-src"] == "'self'"
    assert directives["connect-src"] == "'self'"
    assert directives["frame-ancestors"] == "'none'"
    assert "http" not in CONTENT_SECURITY_POLICY


def test_hashed_assets_are_cached_and_pages_revalidated():
    assert security_headers("/assets/index-abc123.js", https=False)["Cache-Control"] == IMMUTABLE_ASSETS
    assert security_headers("/app/incidents", https=False)["Cache-Control"] == "no-cache"


def test_hsts_only_over_https():
    assert "Strict-Transport-Security" in security_headers("/", https=True)
    assert "Strict-Transport-Security" not in security_headers("/", https=False)


def test_swagger_pages_are_not_blocked_by_csp():
    # FastAPI загружает Swagger UI с CDN; строгая CSP сломала бы документацию API.
    assert "Content-Security-Policy" not in security_headers("/docs", https=False)
    assert "Content-Security-Policy" not in security_headers("/redoc", https=False)


def test_api_is_never_compressed(client):
    response = client.get("/api/v1/health", headers={"Accept-Encoding": "gzip"})
    assert "Content-Encoding" not in response.headers
