# Назначение файла: Описывает дополнительные таблицы суперприложения: документы, задачи, сообщения и связанные записи.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Persistent local SuperApp workflows; personal records remain owner scoped."""

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base
from .models import utcnow


class WorkTask(Base):
    __tablename__ = "cc_work_tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("cc_users.id"))
    incident_id: Mapped[int | None] = mapped_column(
        ForeignKey("cc_incidents.id", ondelete="SET NULL")
    )
    private: Mapped[bool] = mapped_column(default=False)
    status: Mapped[str] = mapped_column(String(30), default="Новая")
    due: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revision: Mapped[int] = mapped_column(default=1)
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ModuleRecord(Base):
    __tablename__ = "cc_module_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(30), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TeamMessage(Base):
    __tablename__ = "cc_team_messages"
    __table_args__ = (UniqueConstraint("author_id", "client_id", name="uq_team_message_client"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), index=True)
    client_id: Mapped[str] = mapped_column(String(36))
    channel: Mapped[str] = mapped_column(String(30), index=True)
    private: Mapped[bool] = mapped_column(default=False)
    text: Mapped[str] = mapped_column(Text)
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Connector(Base):
    __tablename__ = "cc_connectors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    provider: Mapped[str] = mapped_column(String(30))
    owner_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"))
    token_hash: Mapped[str] = mapped_column(String(64))
    enabled: Mapped[bool] = mapped_column(default=True)
    received: Mapped[int] = mapped_column(default=0)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
