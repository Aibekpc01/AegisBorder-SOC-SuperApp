# Назначение файла: Политика HTTP-заголовков безопасности и кэширования для всех ответов.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Заголовки ответа: защита в глубину и корректное кэширование.

Решения:
- CSP разрешает только собственный источник. Интерфейс не использует внешние CDN, шрифты или счётчики,
  поэтому строгая политика ничего не ломает и ограничивает последствия возможной XSS.
- style-src допускает 'unsafe-inline': редактор документов (Tiptap/ProseMirror) задаёт стили атрибутами.
- Страницы Swagger (/docs, /redoc) FastAPI загружает с CDN, поэтому CSP к ним не применяется.
- Файлы /assets/* содержат хеш в имени: их можно кэшировать навсегда. index.html всегда
  перепроверяется, чтобы после обновления пользователи сразу получили новую версию.
"""

CONTENT_SECURITY_POLICY = "; ".join(
    (
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    )
)

# Геолокация нужна для определения города при входе; остальные возможности устройства не используются.
PERMISSIONS_POLICY = "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), serial=(), bluetooth=()"

DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")
IMMUTABLE_ASSETS = "public, max-age=31536000, immutable"


def security_headers(path: str, https: bool) -> dict[str, str]:
    """Возвращает заголовки для ответа на запрос по пути path."""
    headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "same-origin",
        "Permissions-Policy": PERMISSIONS_POLICY,
        "Cross-Origin-Opener-Policy": "same-origin",
    }
    if not path.startswith(DOCS_PATHS):
        headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
    if https:
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if path.startswith("/api"):
        headers["Cache-Control"] = "no-store"
    elif path.startswith("/assets/"):
        headers["Cache-Control"] = IMMUTABLE_ASSETS
    else:
        headers["Cache-Control"] = "no-cache"
    return headers


class StaticCompression:
    """Сжимает gzip статику и HTML, но не ответы API.

    Сборка интерфейса весит ~800 КБ без сжатия и ~250 КБ со сжатием. Ответы /api не сжимаются:
    они содержат пользовательские данные, и сжатие рядом с ними открывает атаки класса BREACH.
    Обратный прокси (Caddy в deploy/oracle) уже сжатые ответы не трогает.
    """

    def __init__(self, app):
        from starlette.middleware.gzip import GZipMiddleware

        self.app = app
        self.gzip = GZipMiddleware(app, minimum_size=1024)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and not scope["path"].startswith("/api"):
            await self.gzip(scope, receive, send)
        else:
            await self.app(scope, receive, send)
