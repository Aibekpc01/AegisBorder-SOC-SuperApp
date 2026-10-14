"""Конкурентные сохранения в отдельной временной схеме PostgreSQL."""

import os
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi import HTTPException
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from app.command.api import audit_verify
from app.command.db import Base
from app.command.models import DocumentVersion, Role, User, WorkspaceDocument
from app.command.workspace import NewDocument, SaveDocument, create, save

schema = "aegis_workspace_test_" + uuid.uuid4().hex
control = create_engine(os.environ["DATABASE_URL"])
with control.begin() as connection:
    connection.execute(text(f"CREATE SCHEMA {schema}"))
engine = create_engine(
    os.environ["DATABASE_URL"], connect_args={"options": f"-csearch_path={schema}"}
)
sessions = sessionmaker(bind=engine, expire_on_commit=False)
try:
    Base.metadata.create_all(engine)
    with sessions() as db:
        db.add(Role(name="admin", description="Тест"))
        db.flush()
        user = User(username="workspace_test", password_hash="unused", role="admin")
        db.add(user)
        db.commit()
        uid = user.id
        doc = create(NewDocument(title="Конкурентный учебный документ"), user, db)
    fields = {
        key: doc[key]
        for key in ("revision", "title", "content", "incident_id", "assignee_id", "status")
    }

    def update_document(index):
        with sessions() as db:
            user = db.get(User, uid)
            try:
                save(
                    doc["id"], SaveDocument(**{**fields, "title": f"Сохранение {index}"}), user, db
                )
                return 200
            except HTTPException as exc:
                return exc.status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(update_document, range(16)))
    assert results.count(200) == 1, results
    assert results.count(409) == 15, results
    with sessions() as db:
        assert db.get(WorkspaceDocument, doc["id"]).revision == 2
        assert len(list(db.scalars(select(DocumentVersion)))) == 2
        assert audit_verify(None, db)["valid"]
    print(
        "PostgreSQL Workspace: 16 concurrent saves, one accepted, 15 conflicts; 2 versions; audit valid"
    )
finally:
    engine.dispose()
    with control.begin() as connection:
        connection.execute(text(f"DROP SCHEMA {schema} CASCADE"))
    control.dispose()
