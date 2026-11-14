# Назначение файла: Проверяет подсистему conftest. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

import os

os.environ["AUDIT_KEY"] = "test-key-only-not-production-" + "x" * 32
os.environ["ADMIN_PASSWORD"] = "test-admin-password-123"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["DLP_ENFORCE"] = "false"  # Enforcement has explicit end-to-end coverage.
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.command import api as module
from app.command.db import Base, get_db


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(module, "SessionLocal", factory)
    monkeypatch.setattr(module, "engine", engine)
    module.attempts.clear()

    def override():
        with factory() as db:
            yield db

    module.app.dependency_overrides[get_db] = override
    with TestClient(module.app) as c:
        c.factory = factory
        yield c
    module.app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def admin(client):
    response = client.post(
        "/api/v1/auth/login", json={"username": "admin", "password": os.environ["ADMIN_PASSWORD"]}
    )
    assert response.status_code == 200
    return client
