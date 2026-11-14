# Назначение файла: Изменение схемы БД: 010_dlp. Применяется Alembic в порядке связей revision/down_revision.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

"""Device-scoped Aegis DLP enrollment and bounded telemetry."""
import sqlalchemy as sa
from alembic import op

revision = "010_dlp"
down_revision = "009_roles"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("cc_dlp_devices",
                    sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("owner_id", sa.Integer(), sa.ForeignKey("cc_users.id"), nullable=False),
                    sa.Column("data", sa.JSON(), nullable=False))
    op.create_index("ix_cc_dlp_devices_owner_id", "cc_dlp_devices", ["owner_id"])


def downgrade():
    op.drop_index("ix_cc_dlp_devices_owner_id", table_name="cc_dlp_devices")
    op.drop_table("cc_dlp_devices")
