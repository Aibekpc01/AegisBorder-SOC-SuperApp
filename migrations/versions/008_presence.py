# Назначение файла: Изменение схемы БД: 008_presence. Применяется Alembic в порядке связей revision/down_revision.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Persistent website connection history, independent of synthetic inventory."""
import sqlalchemy as sa
from alembic import op

revision = "008_presence"
down_revision = "007_connectors"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cc_site_visits",
        sa.Column("session_id", sa.String(64), sa.ForeignKey("cc_auth_sessions.id"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=False),
        sa.Column("device", sa.String(100), nullable=False),
        sa.Column("browser", sa.String(60), nullable=False),
        sa.Column("ip", sa.String(100), nullable=False),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("connected", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_cc_site_visits_user_id", "cc_site_visits", ["user_id"])
    op.create_index("ix_cc_site_visits_last_seen", "cc_site_visits", ["last_seen"])


def downgrade():
    op.drop_table("cc_site_visits")
