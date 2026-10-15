"""Persistent team discussion; personal demo messages stay isolated."""

import sqlalchemy as sa
from alembic import op

revision = "006_team"
down_revision = "005_superapp"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cc_team_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=False),
        sa.Column("client_id", sa.String(36), nullable=False),
        sa.Column("channel", sa.String(30), nullable=False),
        sa.Column("private", sa.Boolean(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("author_id", "client_id", name="uq_team_message_client"),
    )
    for name in ("author_id", "channel"):
        op.create_index("ix_cc_team_messages_" + name, "cc_team_messages", [name])


def downgrade():
    raise RuntimeError("Удаление истории команды запрещено")
