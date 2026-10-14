"""Изолированная проверка Command Center на PostgreSQL: основные таблицы не меняются."""

import os
import uuid
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import sessionmaker

from app.command.api import audit_verify
from app.command.db import Base
from app.command.detection import ingest
from app.command.models import Audit, DemoSession, Event, Incident, Role, Rule, User
from app.command.scenarios import RULES, generate
from app.command.security import audit, hasher

schema = "aegis_command_test_" + uuid.uuid4().hex
control = create_engine(os.environ["DATABASE_URL"])
with control.begin() as c:
    c.execute(text(f"CREATE SCHEMA {schema}"))
engine = create_engine(
    os.environ["DATABASE_URL"], connect_args={"options": f"-csearch_path={schema}"}
)
sessions = sessionmaker(bind=engine, expire_on_commit=False)
try:
    Base.metadata.create_all(engine)
    with sessions() as db:
        db.add(Role(name="admin", description="Тест"))
        db.flush()
        user = User(username="test", password_hash=hasher.hash("not-a-real-password"), role="admin")
        db.add(user)
        db.flush()
        user_id = user.id
        for sid, name, kind, threshold, window, risk, description in RULES:
            if sid != "complex":
                db.add(
                    Rule(
                        id=sid,
                        name=name,
                        event_type=kind,
                        threshold=threshold,
                        window=window,
                        risk=risk,
                        description=description,
                    )
                )
        audit(db, user_id, "Начало теста")
        db.commit()
    payload = generate("bruteforce", 777)[0]

    def insert(_):
        with sessions() as db:
            event, _, duplicate = ingest(db, payload, user_id)
            audit(db, user_id, f"Конкурентная проверка: duplicate={duplicate}")
            db.commit()
            return duplicate

    with ThreadPoolExecutor(max_workers=8) as pool:
        duplicates = list(pool.map(insert, range(24)))
    assert duplicates.count(False) == 1
    with sessions() as db:
        assert db.scalar(select(func.count()).select_from(Event)) == 1
        for item in generate("complex", 778):
            ingest(db, item, user_id)
        db.commit()
        assert db.scalar(select(func.max(Incident.risk))) == 95
        assert audit_verify(None, db)["valid"]
        assert db.scalar(select(func.count()).select_from(Audit)) == 25
    with sessions() as db:
        for index, definition in enumerate(RULES):
            sid = definition[0]
            demo = DemoSession(owner_id=user_id)
            db.add(demo)
            db.flush()
            for item in generate(sid, 9000 + index):
                ingest(db, item, user_id, demo.id)
            db.flush()
            expected = "bruteforce" if sid == "complex" else sid
            assert db.scalar(
                select(Incident.id).where(Incident.demo_id == demo.id, Incident.rule_id == expected)
            ), sid
        db.commit()
    print(
        "OK PostgreSQL: 15 scenarios, 24 concurrent submissions, one event, valid audit, complex risk 95"
    )
finally:
    engine.dispose()
    with control.begin() as c:
        c.execute(text(f"DROP SCHEMA {schema} CASCADE"))
    control.dispose()
