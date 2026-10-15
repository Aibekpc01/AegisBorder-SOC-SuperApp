"""Authenticated corporate event receivers."""

import sqlalchemy as sa
from alembic import op

revision = "007_connectors"
down_revision = "006_team"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cc_connectors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("received", sa.Integer(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True)),
        sa.Column("received_at", sa.DateTime(timezone=True)),
        sa.Column("created", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    raise RuntimeError("Удаление конфигурации интеграций запрещено")
