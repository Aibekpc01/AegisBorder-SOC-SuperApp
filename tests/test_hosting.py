# Назначение файла: Проверяет подсистему hosting. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import pytest

from app.command.hosting import database_url, public_origin


def test_postgresql_hosting_url_uses_installed_driver():
    assert database_url("postgres://user:pass@db/name") == "postgresql+psycopg2://user:pass@db/name"
    assert (
        database_url("postgresql://user:pass@db/name") == "postgresql+psycopg2://user:pass@db/name"
    )
    assert database_url("sqlite://") == "sqlite://"


def test_render_origin_and_manual_override(monkeypatch):
    monkeypatch.delenv("PUBLIC_ORIGIN", raising=False)
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://aegisborder.onrender.com")
    assert public_origin() == "https://aegisborder.onrender.com"
    monkeypatch.setenv("PUBLIC_ORIGIN", "https://custom.example.test/")
    assert public_origin() == "https://custom.example.test"


@pytest.mark.parametrize(
    "value",
    [
        "https://host.test/app",
        "https://user:password@host.test",
        "https://host.test?query=1",
        "file:///tmp/test",
    ],
)
def test_hosting_rejects_non_origin_values(monkeypatch, value):
    monkeypatch.setenv("PUBLIC_ORIGIN", value)
    with pytest.raises(RuntimeError):
        public_origin()
