"""Документы Workspace; существующие данные не изменяются."""

import sqlalchemy as sa
from alembic import op

revision = "004_workspace"
down_revision = "003_profiles_access"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cc_workspace_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("plain_text", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=False),
        sa.Column("assignee_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=True),
        sa.Column("incident_id", sa.Integer(), sa.ForeignKey("cc_incidents.id"), nullable=True),
        sa.Column("demo_only", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("revision >= 1", name="ck_document_revision"),
        sa.CheckConstraint(
            "status IN ('Черновик', 'На проверке', 'Утверждён')", name="ck_document_status"
        ),
    )
    for name in ("title", "owner_id", "incident_id", "updated"):
        op.create_index("ix_cc_workspace_documents_" + name, "cc_workspace_documents", [name])
    op.create_table(
        "cc_document_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "document_id", sa.Integer(), sa.ForeignKey("cc_workspace_documents.id"), nullable=False
        ),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("digest", sa.String(64), nullable=False),
        sa.Column("created", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("document_id", "revision", name="uq_document_version"),
    )
    op.create_index("ix_cc_document_versions_document_id", "cc_document_versions", ["document_id"])
    op.create_table(
        "cc_document_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "document_id", sa.Integer(), sa.ForeignKey("cc_workspace_documents.id"), nullable=False
        ),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_cc_document_comments_document_id", "cc_document_comments", ["document_id"])


def downgrade():
    raise RuntimeError("Удаление документов и их истории запрещено")
