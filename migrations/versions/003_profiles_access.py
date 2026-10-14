"""Профили, безопасные фото и история адресов входа."""

import sqlalchemy as sa
from alembic import op

revision = "003_profiles_access"
down_revision = "002_roles"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cc_user_profiles",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("cc_users.id"), primary_key=True),
        sa.Column("full_name", sa.String(160), nullable=False),
        sa.Column("department", sa.String(120), nullable=False),
        sa.Column("position", sa.String(120), nullable=False),
        sa.Column("email", sa.String(160), nullable=False),
        sa.Column("phone", sa.String(40), nullable=False),
        sa.Column("bio", sa.Text(), nullable=False),
        sa.Column("avatar_data", sa.LargeBinary(), nullable=True),
        sa.Column("updated", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "cc_login_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=True),
        sa.Column("session_id", sa.String(64), sa.ForeignKey("cc_auth_sessions.id"), nullable=True),
        sa.Column("username", sa.String(80), nullable=False),
        sa.Column("time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ip", sa.String(100), nullable=False),
        sa.Column("peer_ip", sa.String(100), nullable=False),
        sa.Column("ip_source", sa.String(80), nullable=False),
        sa.Column("user_agent", sa.String(512), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("reason", sa.String(200), nullable=False),
        sa.Column("network", sa.JSON(), nullable=False),
        sa.Column("location", sa.JSON(), nullable=True),
    )
    for col in ("user_id", "session_id", "time"):
        op.create_index("ix_cc_login_records_" + col, "cc_login_records", [col])


def downgrade():
    raise RuntimeError("Удаление пользовательских профилей и истории запрещено")
