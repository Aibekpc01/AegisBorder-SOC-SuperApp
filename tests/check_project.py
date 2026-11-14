# Назначение файла: Проверяет подсистему check_project. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Проверка функций в отдельной временной схеме PostgreSQL, без изменения основной базы."""

import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from starlette.routing import Match

from app import legacy_main as m

schema = "aegis_test_" + uuid.uuid4().hex
control = create_engine(os.environ["DATABASE_URL"])
with control.begin() as connection:
    connection.execute(text(f"CREATE SCHEMA {schema}"))
engine = create_engine(
    os.environ["DATABASE_URL"], connect_args={"options": f"-csearch_path={schema}"}
)
sessions = sessionmaker(bind=engine)
try:
    m.Base.metadata.create_all(engine)
    scope = {"type": "http", "path": "/api/v1/scenarios/reset", "method": "POST"}
    route = next(r for r in m.app.routes if r.matches(scope)[0] == Match.FULL)
    assert route.endpoint is m.reset, "Неверный маршрут очистки"
    with sessions() as db:
        user = m.User(
            username="test_admin", role="admin", password_hash=m.password_hash("test-password-only")
        )
        db.add(user)
        db.commit()
        assert m.verify_password("test-password-only", user.password_hash)
        assert not m.verify_password("wrong", user.password_hash)
        result = m.run_scenario("bruteforce", user, db)
        assert m.dashboard(user, db)["events"] == 6
        assert m.dashboard(user, db)["incidents"] == 1
        m.update_incident(result["id"], m.StatusUpdate(status="Закрыт"), user, db)
        assert m.dashboard(user, db)["open_incidents"] == 0
        assert m.audit_verify(user, db)["valid"]
        m.reset(user, db)
        assert m.dashboard(user, db)["events"] == 0
        assert m.dashboard(user, db)["incidents"] == 0

    def append(index):
        with sessions() as db:
            m.audit(db, "test_admin", f"Concurrent test {index}")
            db.commit()

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(append, range(24)))
    with sessions() as db:
        assert m.audit_verify(None, db)["valid"], "Цепочка нарушена параллельными запросами"
        row = db.query(m.Audit).first()
        row.action = "tampered"
        db.commit()
        assert not m.audit_verify(None, db)["valid"], "Подмена не обнаружена"
    print("OK: routing, passwords, scenario, status, reset, concurrent audit, tamper detection")
finally:
    engine.dispose()
    with control.begin() as connection:
        connection.execute(text(f"DROP SCHEMA {schema} CASCADE"))
    control.dispose()
