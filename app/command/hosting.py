"""Explicit origins and managed PostgreSQL URL compatibility."""

import os
from urllib.parse import urlsplit


def public_origin():
    value = (os.getenv("PUBLIC_ORIGIN") or os.getenv("RENDER_EXTERNAL_URL") or "").rstrip("/")
    if not value:
        return ""
    parsed = urlsplit(value)
    if (
        parsed.scheme not in ("http", "https")
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.path
        or parsed.query
        or parsed.fragment
    ):
        raise RuntimeError("PUBLIC_ORIGIN / RENDER_EXTERNAL_URL must be a clean HTTP(S) origin")
    return value


def database_url(value):
    if value.startswith("postgres://"):
        return "postgresql+psycopg2://" + value[len("postgres://") :]
    if value.startswith("postgresql://"):
        return "postgresql+psycopg2://" + value[len("postgresql://") :]
    return value
