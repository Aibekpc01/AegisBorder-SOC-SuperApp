from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow():
    return datetime.now(timezone.utc)


class Role(Base):
    __tablename__ = "cc_roles"
    name: Mapped[str] = mapped_column(String(30), primary_key=True)
    description: Mapped[str] = mapped_column(String(150))


class User(Base):
    __tablename__ = "cc_users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True)
    password_hash: Mapped[str] = mapped_column(String(250))
    role: Mapped[str] = mapped_column(
        ForeignKey("cc_roles.name", name="fk_cc_users_role"), default="observer"
    )
    active: Mapped[bool] = mapped_column(default=True)


class AuthSession(Base):
    __tablename__ = "cc_auth_sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), index=True)
    expires: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(default=False)


class UserProfile(Base):
    __tablename__ = "cc_user_profiles"
    user_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(160), default="")
    department: Mapped[str] = mapped_column(String(120), default="")
    position: Mapped[str] = mapped_column(String(120), default="")
    email: Mapped[str] = mapped_column(String(160), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    avatar_data: Mapped[bytes | None] = mapped_column(LargeBinary)
    updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LoginRecord(Base):
    __tablename__ = "cc_login_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("cc_users.id"), index=True)
    session_id: Mapped[str | None] = mapped_column(ForeignKey("cc_auth_sessions.id"), index=True)
    username: Mapped[str] = mapped_column(String(80))
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    ip: Mapped[str] = mapped_column(String(100))
    peer_ip: Mapped[str] = mapped_column(String(100))
    ip_source: Mapped[str] = mapped_column(String(80))
    user_agent: Mapped[str] = mapped_column(String(512))
    success: Mapped[bool] = mapped_column()
    reason: Mapped[str] = mapped_column(String(200))
    network: Mapped[dict] = mapped_column(JSON, default=dict)
    location: Mapped[dict | None] = mapped_column(JSON(none_as_null=True))


class DemoSession(Base):
    __tablename__ = "cc_demo_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), index=True)
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    title: Mapped[str] = mapped_column(String(150), default="Проверка возможностей системы")
    progress: Mapped[int] = mapped_column(default=0)


class Asset(Base):
    __tablename__ = "cc_assets"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    kind: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40), default="В сети")
    criticality: Mapped[int] = mapped_column(default=70)
    description: Mapped[str] = mapped_column(Text, default="Синтетическое устройство")


class Rule(Base):
    __tablename__ = "cc_detection_rules"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    enabled: Mapped[bool] = mapped_column(default=True)
    threshold: Mapped[int] = mapped_column(default=1)
    window: Mapped[int] = mapped_column(default=60)
    risk: Mapped[int] = mapped_column(default=70)
    event_type: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(Text)


class ScenarioRun(Base):
    __tablename__ = "cc_scenario_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    scenario: Mapped[str] = mapped_column(String(60))
    owner_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), index=True)
    demo_id: Mapped[int | None] = mapped_column(ForeignKey("cc_demo_sessions.id"), index=True)
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Event(Base):
    __tablename__ = "cc_security_events"
    __table_args__ = (UniqueConstraint("external_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(80))
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    device: Mapped[str] = mapped_column(String(80), index=True)
    account: Mapped[str] = mapped_column(String(80), index=True)
    source: Mapped[str] = mapped_column(String(80))
    type: Mapped[str] = mapped_column(String(60), index=True)
    severity: Mapped[str] = mapped_column(String(30), default="Информация")
    detail: Mapped[str] = mapped_column(Text)
    features: Mapped[dict] = mapped_column(JSON, default=dict)
    owner_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), index=True)
    demo_id: Mapped[int | None] = mapped_column(ForeignKey("cc_demo_sessions.id"), index=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("cc_scenario_runs.id"))


class Incident(Base):
    __tablename__ = "cc_incidents"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    risk: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(40), default="Новый", index=True)
    explanation: Mapped[str] = mapped_column(Text)
    recommendations: Mapped[list] = mapped_column(JSON)
    device: Mapped[str] = mapped_column(String(80), index=True)
    account: Mapped[str] = mapped_column(String(80))
    rule_id: Mapped[str] = mapped_column(ForeignKey("cc_detection_rules.id"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), index=True)
    demo_id: Mapped[int | None] = mapped_column(ForeignKey("cc_demo_sessions.id"), index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("cc_users.id"))
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class IncidentEvent(Base):
    __tablename__ = "cc_incident_events"
    incident_id: Mapped[int] = mapped_column(ForeignKey("cc_incidents.id"), primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("cc_security_events.id"), primary_key=True)


class Alert(Base):
    __tablename__ = "cc_alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("cc_incidents.id"))
    rule_id: Mapped[str] = mapped_column(ForeignKey("cc_detection_rules.id"))
    evidence: Mapped[dict] = mapped_column(JSON)


class Comment(Base):
    __tablename__ = "cc_incident_comments"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("cc_incidents.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"))
    text: Mapped[str] = mapped_column(Text)
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class History(Base):
    __tablename__ = "cc_incident_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("cc_incidents.id"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"))
    action: Mapped[str] = mapped_column(Text)
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Investigation(Base):
    __tablename__ = "cc_investigations"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("cc_incidents.id"), unique=True)
    conclusion: Mapped[str] = mapped_column(Text, default="")
    checklist: Mapped[list] = mapped_column(JSON, default=list)
    updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Audit(Base):
    __tablename__ = "cc_audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"), index=True)
    action: Mapped[str] = mapped_column(Text)
    time: Mapped[str] = mapped_column(String(60))
    prev_hash: Mapped[str] = mapped_column(String(64))
    record_hash: Mapped[str] = mapped_column(String(64))


class Report(Base):
    __tablename__ = "cc_reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("cc_incidents.id"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"))
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    snapshot: Mapped[dict] = mapped_column(JSON)


class ModelVersion(Base):
    __tablename__ = "cc_model_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[str] = mapped_column(String(50))
    parameters: Mapped[dict] = mapped_column(JSON)
    results: Mapped[list] = mapped_column(JSON)
    owner_id: Mapped[int] = mapped_column(ForeignKey("cc_users.id"))
    created: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Setting(Base):
    __tablename__ = "cc_settings"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)
